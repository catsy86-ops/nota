import type { Note, ChecklistItem } from "@/hooks/useNotes";
import type { YjsStore } from "@/lib/yjsStore";
import { yjsStore as defaultStore } from "@/lib/yjsStore";
import { versionsStore as defaultVersions, type VersionsStore } from "@/lib/versionsStore";
import { logDiag, logSecurity } from "@/lib/diagnostics";
import {
  KDF_ITERATIONS, VaultError, createVault, decryptString, encryptString, isValidMeta, noteAad,
  unlockWithPassword, unlockWithRecovery, type VaultMeta,
} from "@/lib/vault";

/**
 * Sesja skarbca i operacje na notatkach prywatnych.
 *
 * Zasada: jawna treść notatki prywatnej istnieje WYŁĄCZNIE w pamięci tego
 * modułu (`cache`), dopóki skarbiec jest odblokowany. Dokument Yjs, IndexedDB,
 * localStorage, backup i synchronizacja dostają tylko szyfrogram. Projekcja
 * notatki prywatnej jest pusta (patrz `yjsStore.plainFromYNote`), więc reszta
 * aplikacji — wyszukiwarka, graf, przegląd, eksport — nie ma czego wyciec.
 * Treść widzi wyłącznie karta (przez `PrivateNoteGate`), po odblokowaniu.
 */

export interface PrivateContent {
  title: string;
  content: string;
  checklist: ChecklistItem[];
  labels: string[];
}

export type VaultPhase = "none" | "locked" | "unlocked" | "locking";

export interface VaultSnapshot {
  phase: VaultPhase;
  /** Rośnie przy każdej zmianie widocznej dla UI (stan, treść w pamięci). */
  version: number;
}

export type LockNoteResult =
  | { ok: true }
  | { ok: false; reason: "session-locked" | "missing" | "has-files" | "changed" | "error" };

/** Za dużo prób hasła — odczekaj. */
export class VaultThrottledError extends Error {
  constructor(public readonly retryAt: number) {
    super("vault-throttled");
    this.name = "VaultThrottledError";
  }
}

const THROTTLE_KEY = "kaczy.vault.attempts.v1";
const FREE_ATTEMPTS = 2;
const MAX_DELAY_MS = 5 * 60_000;

/** Opóźnienie po `fails` nieudanych próbach z rzędu: 0, 0, 2 s, 4 s, 8 s … max 5 min. */
export function throttleDelayMs(fails: number): number {
  if (fails <= FREE_ATTEMPTS) return 0;
  return Math.min(MAX_DELAY_MS, 2000 * 2 ** (fails - FREE_ATTEMPTS - 1));
}

function readThrottle(): { fails: number; until: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(THROTTLE_KEY) || "null");
    if (raw && typeof raw.fails === "number" && typeof raw.until === "number") return raw;
  } catch { /* uszkodzone — zaczynamy od zera */ }
  return { fails: 0, until: 0 };
}

function writeThrottle(v: { fails: number; until: number } | null) {
  try {
    if (v && v.fails > 0) localStorage.setItem(THROTTLE_KEY, JSON.stringify(v));
    else localStorage.removeItem(THROTTLE_KEY);
  } catch { /* brak miejsca — limit działa tylko w pamięci karty */ }
}


function parseContent(json: string): PrivateContent {
  const raw = JSON.parse(json) as Partial<PrivateContent> | null;
  if (!raw || typeof raw !== "object") throw new VaultError("bad-format");
  const checklist = Array.isArray(raw.checklist)
    ? raw.checklist
      .filter((i): i is ChecklistItem => !!i && typeof i === "object" && typeof (i as ChecklistItem).id === "string")
      .map((i) => ({ id: i.id, text: typeof i.text === "string" ? i.text : "", checked: Boolean(i.checked), ...(i.indent === 1 ? { indent: 1 as const } : {}) }))
    : [];
  return {
    title: typeof raw.title === "string" ? raw.title : "",
    content: typeof raw.content === "string" ? raw.content : "",
    checklist,
    labels: Array.isArray(raw.labels) ? raw.labels.filter((l): l is string => typeof l === "string") : [],
  };
}

interface Entry {
  /** Szyfrogram, z którego (albo do którego) ta treść pochodzi. */
  vault: string;
  content: PrivateContent;
  /** Są zmiany jeszcze nieszyfrowane do dokumentu. */
  dirty: boolean;
}

export interface PrivateNotesOptions {
  /** Liczba iteracji PBKDF2 przy zakładaniu skarbca (testy używają mało). */
  iterations?: number;
  /** Najniższa akceptowana liczba iteracji w metadanych z dokumentu. */
  minIterations?: number;
  /** Opóźnienie zapisu szyfrogramu po edycji. */
  writeDelayMs?: number;
  versions?: VersionsStore;
  now?: () => number;
}

export function createPrivateNotes(store: YjsStore, opts: PrivateNotesOptions = {}) {
  const iterations = opts.iterations ?? KDF_ITERATIONS;
  const minIterations = opts.minIterations ?? KDF_ITERATIONS;
  const writeDelayMs = opts.writeDelayMs ?? 400;
  const versions = opts.versions ?? defaultVersions;
  const now = opts.now ?? (() => Date.now());

  let key: CryptoKey | null = null;
  let sessionEpoch = 0;
  let locking = false;
  let version = 0;
  let snapshot: VaultSnapshot = { phase: "none", version: 0 };
  const cache = new Map<string, Entry>();
  /** Id notatek, których szyfrogramu nie da się odszyfrować tym kluczem. */
  const failed = new Set<string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const decrypting = new Map<string, Promise<void>>();
  const listeners = new Set<() => void>();
  let chain: Promise<void> = Promise.resolve();
  let compactTimer: ReturnType<typeof setTimeout> | null = null;

  let rejectedMetaLogged = false;
  function meta(): VaultMeta | null {
    const m = store.getVaultMeta();
    if (isValidMeta(m)) { rejectedMetaLogged = false; return m; }
    // Coś jest pod kluczem skarbca, ale to nie są poprawne metadane (peer/plik/uszkodzenie).
    if (m !== undefined && m !== null && !rejectedMetaLogged) {
      rejectedMetaLogged = true;
      logSecurity("vault-meta-rejected", "metadane skarbca z dokumentu mają zły kształt lub parametry KDF");
    }
    return null;
  }

  function phase(): VaultPhase {
    if (key) return locking ? "locking" : "unlocked";
    return meta() ? "locked" : "none";
  }

  function emit() {
    version++;
    snapshot = { phase: phase(), version };
    listeners.forEach((l) => l());
  }
  snapshot = { phase: phase(), version };

  // Metadane zmienione z zewnątrz (sync): pojawił się skarbiec albo hasło zmieniono na innym urządzeniu.
  store.observeVaultMeta(() => {
    const m = meta();
    if (key && (!m || m.epoch !== sessionEpoch)) void lock();
    else emit();
  });

  // Historia wersji trzyma jawny tekst, więc dla notatek prywatnych jej po prostu nie ma.
  versions.setBlocker((id) => store.isLocked(id));

  store.setLockedWriteSink((id, fields) => {
    if (fields.images?.length || fields.attachments?.length) {
      logDiag("warn", "privateNotes", "files are not allowed in a private note — dropped");
    }
    const entry = cache.get(id);
    if (!key || !entry) {
      logDiag("warn", "privateNotes", "write to a private note without an unlocked vault — dropped");
      return;
    }
    const next: PrivateContent = { ...entry.content };
    if (fields.title !== undefined) next.title = fields.title;
    if (fields.content !== undefined) next.content = fields.content;
    if (fields.checklist !== undefined) next.checklist = fields.checklist.map((i) => ({ ...i }));
    if (fields.labels !== undefined) next.labels = fields.labels.slice();
    cache.set(id, { ...entry, content: next, dirty: true });
    schedule(id);
    emit();
  });

  function schedule(id: string) {
    const t = timers.get(id);
    if (t) clearTimeout(t);
    timers.set(id, setTimeout(() => { timers.delete(id); void writeNow(id); }, writeDelayMs));
  }

  function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(fn, fn);
    chain = run.then(() => undefined, () => undefined);
    return run;
  }

  function writeNow(id: string): Promise<void> {
    return enqueue(async () => {
      const k = key;
      const entry = cache.get(id);
      if (!k || !entry || !entry.dirty) return;
      const content = entry.content;
      const token = await encryptString(k, JSON.stringify(content), noteAad(id));
      const current = cache.get(id);
      if (!current || !store.isLocked(id)) return;
      store.setVault(id, token);
      // Zmiana w trakcie szyfrowania zostaje „brudna” — kolejny zapis ją zabierze.
      const stillSame = current.content === content;
      cache.set(id, { ...current, vault: token, dirty: !stillSame });
      if (!stillSame) schedule(id);
    });
  }

  /** Zapisuje wszystkie oczekujące zmiany (przed blokadą, zmianą hasła, backupem). */
  async function flush(): Promise<void> {
    for (const [id, t] of timers) { clearTimeout(t); timers.delete(id); }
    for (const [id, e] of [...cache]) if (e.dirty) await writeNow(id);
    await chain;
  }

  async function decryptOne(id: string, token: string): Promise<void> {
    const k = key;
    if (!k) return;
    try {
      const plain = await decryptString(k, token, noteAad(id));
      if (key !== k) return; // skarbiec zablokowany w trakcie
      const existing = cache.get(id);
      if (existing?.dirty) return; // lokalna, niezapisana edycja ma pierwszeństwo (LWW)
      cache.set(id, { vault: token, content: parseContent(plain), dirty: false });
      failed.delete(id);
    } catch (err) {
      if (key !== k) return;
      failed.add(id);
      cache.delete(id);
      logDiag("warn", "privateNotes", "cannot decrypt a private note", err instanceof VaultError ? err.code : err);
    }
  }

  /** Odszyfrowuje notatkę prywatną do pamięci, jeśli jeszcze nie jest (albo szyfrogram się zmienił). */
  function ensureDecrypted(note: Pick<Note, "id" | "vault">): Promise<void> {
    if (!key || !note.vault) return Promise.resolve();
    const entry = cache.get(note.id);
    if (entry && (entry.vault === note.vault || entry.dirty)) return Promise.resolve();
    const tag = `${note.id}:${note.vault}`;
    const inflight = decrypting.get(tag);
    if (inflight) return inflight;
    const p = decryptOne(note.id, note.vault).then(() => { decrypting.delete(tag); emit(); });
    decrypting.set(tag, p);
    return p;
  }

  async function decryptAll(): Promise<void> {
    await Promise.all(store.lockedNoteIds().map((id) => decryptOne(id, store.getVault(id)!)));
  }

  // ── próby hasła ─────────────────────────────────────────────────────────────

  function checkThrottle() {
    const t = readThrottle();
    if (t.until > now()) {
      logSecurity("vault-throttled", `blokada prób do ${new Date(t.until).toISOString()}`);
      throw new VaultThrottledError(t.until);
    }
  }
  function recordFailure(kind: "vault-unlock-failed" | "vault-recovery-failed" = "vault-unlock-failed") {
    const t = readThrottle();
    const fails = t.fails + 1;
    logSecurity(kind, `kolejna nieudana próba z rzędu: ${fails}`);
    writeThrottle({ fails, until: now() + throttleDelayMs(fails) });
  }
  function recordSuccess() { writeThrottle(null); }

  /** Ile jeszcze trzeba czekać, zanim wolno spróbować ponownie (0 = wolno). */
  function retryInMs(): number {
    return Math.max(0, readThrottle().until - now());
  }

  async function adoptKey(newKey: CryptoKey, epoch: number): Promise<void> {
    key = newKey;
    sessionEpoch = epoch;
    locking = false;
    failed.clear();
    await decryptAll();
    emit();
  }

  // ── cykl życia ──────────────────────────────────────────────────────────────

  /** Pierwsze użycie: zakłada skarbiec. Zwraca kod awaryjny (pokazać raz) albo `null`. */
  async function setup(password: string, { withRecovery = true }: { withRecovery?: boolean } = {}): Promise<{ recoveryCode: string | null }> {
    if (meta()) throw new Error("Skarbiec już istnieje — odblokuj go");
    const created = await createVault(password, { iterations, withRecovery });
    store.setVaultMeta(created.meta);
    await adoptKey(created.dataKey, created.meta.epoch);
    return { recoveryCode: created.recoveryCode };
  }

  async function unlock(password: string): Promise<void> {
    const m = meta();
    if (!m) throw new Error("Brak skarbca");
    checkThrottle();
    let k: CryptoKey;
    try {
      k = await unlockWithPassword(m, password, minIterations);
    } catch (err) {
      if (err instanceof VaultError && err.code === "bad-password") recordFailure();
      throw err;
    }
    recordSuccess();
    await adoptKey(k, m.epoch);
  }

  async function unlockWithRecoveryCode(code: string): Promise<void> {
    const m = meta();
    if (!m) throw new Error("Brak skarbca");
    checkThrottle();
    let k: CryptoKey;
    try {
      k = await unlockWithRecovery(m, code);
    } catch (err) {
      if (err instanceof VaultError && err.code === "bad-recovery") recordFailure("vault-recovery-failed");
      throw err;
    }
    recordSuccess();
    await adoptKey(k, m.epoch);
  }

  /**
   * Blokada: najpierw UI przechodzi na kafle z kłódką (karty odmontowują się i
   * zatwierdzają szkice, póki klucz jeszcze jest), potem zapisujemy oczekujące
   * zmiany i dopiero wtedy klucz oraz jawna treść znikają z pamięci.
   */
  async function lock(): Promise<void> {
    if (!key || locking) return;
    locking = true;
    emit();
    await new Promise((r) => setTimeout(r, 40));
    try { await flush(); } catch (err) { logDiag("error", "privateNotes", "flush before lock failed", err); }
    key = null;
    locking = false;
    cache.clear();
    failed.clear();
    decrypting.clear();
    for (const [, t] of timers) clearTimeout(t);
    timers.clear();
    emit();
  }

  // ── operacje na notatkach ───────────────────────────────────────────────────

  async function lockNote(id: string): Promise<LockNoteResult> {
    const k = key;
    if (!k || locking) return { ok: false, reason: "session-locked" };
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const plain = store.readPlainNote(id);
        if (!plain) return { ok: false, reason: "missing" };
        if (plain.images.length || plain.attachments?.length) return { ok: false, reason: "has-files" };
        const content: PrivateContent = { title: plain.title, content: plain.content, checklist: plain.checklist, labels: plain.labels };
        const json = JSON.stringify(content);
        const token = await encryptString(k, json, noteAad(id));
        // Edytor mógł zatwierdzić szkic w trakcie szyfrowania — wtedy powtarzamy.
        const again = store.readPlainNote(id);
        if (!again || JSON.stringify({ title: again.title, content: again.content, checklist: again.checklist, labels: again.labels }) !== json) continue;
        if (!store.lockNote(id, token)) return { ok: false, reason: "missing" };
        cache.set(id, { vault: token, content, dirty: false });
        versions.remove(id);
        scheduleCompaction();
        emit();
        return { ok: true };
      }
      return { ok: false, reason: "changed" };
    } catch (err) {
      logDiag("error", "privateNotes", "lockNote failed", err);
      return { ok: false, reason: "error" };
    }
  }

  /** Zdejmuje blokadę z jednej notatki (wymaga odblokowanego skarbca). */
  async function removeLock(id: string): Promise<boolean> {
    if (!key || locking) return false;
    const entry = cache.get(id);
    if (!entry) return false;
    const t = timers.get(id);
    if (t) { clearTimeout(t); timers.delete(id); }
    const ok = store.unlockNote(id, entry.content);
    cache.delete(id);
    emit();
    return ok;
  }

  /** Kopia notatki prywatnej — zaszyfrowana pod nowym id (AAD!). */
  async function duplicate(id: string): Promise<string | null> {
    const k = key;
    const entry = cache.get(id);
    const original = store.projectNotes().find((n) => n.id === id);
    if (!k || !entry || !original) return null;
    const newId = crypto.randomUUID();
    const content: PrivateContent = { ...entry.content, title: entry.content.title ? `${entry.content.title} (kopia)` : "" };
    const token = await encryptString(k, JSON.stringify(content), noteAad(newId));
    const t = now();
    const { dailyDate: _daily, ...rest } = original;
    store.upsertNote({ ...rest, id: newId, locked: true, vault: token, pinned: false, createdAt: t, updatedAt: t });
    cache.set(newId, { vault: token, content, dirty: false });
    emit();
    return newId;
  }

  /**
   * Nowe hasło = nowy klucz danych: wszystkie notatki prywatne są
   * przeszyfrowane i zapisane razem z nowymi metadanymi w jednej transakcji
   * dokumentu. Błąd na dowolnym etapie nie zapisuje niczego. Notatki, których
   * i tak nie dało się odszyfrować (obcy szyfrogram), są zgłaszane w `skipped`.
   */
  async function rekey(oldKey: CryptoKey, newPassword: string, withRecovery: boolean): Promise<{ recoveryCode: string | null; skipped: string[] }> {
    const m = meta();
    if (!m) throw new Error("Brak skarbca");
    await flush();
    const plain = new Map<string, { expected: string; json: string }>();
    const skipped: string[] = [];
    for (const id of store.lockedNoteIds()) {
      const token = store.getVault(id)!;
      try { plain.set(id, { expected: token, json: await decryptString(oldKey, token, noteAad(id)) }); } catch { skipped.push(id); }
    }
    const created = await createVault(newPassword, { iterations, withRecovery, epoch: m.epoch + 1 });
    const next = new Map<string, { expected: string; vault: string }>();
    for (const [id, p] of plain) next.set(id, { expected: p.expected, vault: await encryptString(created.dataKey, p.json, noteAad(id)) });
    // Zmiana w trakcie (np. edycja z innego urządzenia) — przerywamy bez zapisu.
    if (!store.rekeyVault(created.meta, next)) throw new Error("Notatki zmieniły się w trakcie zmiany hasła — spróbuj ponownie");
    key = created.dataKey;
    sessionEpoch = created.meta.epoch;
    locking = false;
    for (const [id, n] of next) {
      const e = cache.get(id);
      if (e) cache.set(id, { ...e, vault: n.vault });
    }
    emit();
    scheduleCompaction();
    return { recoveryCode: created.recoveryCode, skipped };
  }

  async function changePassword(oldPassword: string, newPassword: string, { withRecovery = true }: { withRecovery?: boolean } = {}) {
    const m = meta();
    if (!m) throw new Error("Brak skarbca");
    checkThrottle();
    let oldKey: CryptoKey;
    try { oldKey = await unlockWithPassword(m, oldPassword, minIterations); } catch (err) {
      if (err instanceof VaultError && err.code === "bad-password") recordFailure();
      throw err;
    }
    recordSuccess();
    return rekey(oldKey, newPassword, withRecovery);
  }

  /** Nowe hasło za pomocą kodu awaryjnego (zapomniane hasło). */
  async function resetPasswordWithRecovery(recoveryCode: string, newPassword: string, { withRecovery = true }: { withRecovery?: boolean } = {}) {
    const m = meta();
    if (!m) throw new Error("Brak skarbca");
    checkThrottle();
    let oldKey: CryptoKey;
    try { oldKey = await unlockWithRecovery(m, recoveryCode); } catch (err) {
      if (err instanceof VaultError && err.code === "bad-recovery") recordFailure();
      throw err;
    }
    recordSuccess();
    const result = await rekey(oldKey, newPassword, withRecovery);
    failed.clear();
    await decryptAll();
    emit();
    return result;
  }

  function scheduleCompaction() {
    if (compactTimer) clearTimeout(compactTimer);
    compactTimer = setTimeout(() => { compactTimer = null; void store.compactPersistence(); }, 1500);
  }

  return {
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
    getSnapshot: () => snapshot,
    phase,
    hasVault: () => meta() !== null,
    isUnlocked: () => key !== null && !locking,
    /** Odszyfrowana treść notatki prywatnej (albo `undefined`, gdy zablokowane / nieodszyfrowane). */
    peek: (id: string): PrivateContent | undefined => (key && !locking ? cache.get(id)?.content : undefined),
    peekToken: (id: string): string | undefined => (key && !locking ? cache.get(id)?.vault : undefined),
    isUndecryptable: (id: string) => failed.has(id),
    hasRecovery: () => Boolean(meta()?.recovery),
    ensureDecrypted,
    setup, unlock, unlockWithRecoveryCode, lock, flush,
    lockNote, removeLock, duplicate, changePassword, resetPasswordWithRecovery,
    retryInMs,
  };
}

export type PrivateNotes = ReturnType<typeof createPrivateNotes>;

export const privateNotes = createPrivateNotes(defaultStore);
