import type { Note, ChecklistItem } from "@/hooks/useNotes";
import type { YjsStore } from "@/lib/yjsStore";
import { yjsStore as defaultStore } from "@/lib/yjsStore";
import { versionsStore as defaultVersions, type VersionsStore } from "@/lib/versionsStore";
import { logDiag, logSecurity } from "@/lib/diagnostics";
import { NOTE_COLORS } from "@/lib/safeProjection";
import { METADATA_IN_CIPHERTEXT_SCHEMA, writeFormatAllowed } from "@/lib/formatSchema";
import { comparePin, readVaultPin, writeVaultPin } from "@/lib/vaultPin";
import { assertPasskey, registerPasskey } from "@/lib/passkey";
import { MAX_PASSKEYS, unlockWithPasskey as unlockKeyWithPasskey, unwrapRawWithPassword, wrapDataKeyForPasskey, fromB64u, toB64u } from "@/lib/vault";
import { toast } from "sonner";
import {
  KDF_ITERATIONS, VaultError, createVault, decryptNoteString, encryptNoteStringV2, encryptString, isValidMeta, noteAad,
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

export type PrivateMeta = Partial<Pick<Note, "color" | "folderId" | "parentId" | "icon">>;

export interface PrivateContent {
  title: string;
  content: string;
  checklist: ChecklistItem[];
  labels: string[];
  /** Metadane notatki w szyfrogramie (V-3, krok 3); brak w starszych treściach = metadane w dokumencie. */
  meta?: PrivateMeta;
}

export type VaultPhase = "none" | "locked" | "unlocked" | "locking";

export interface VaultSnapshot {
  phase: VaultPhase;
  /** Pod kluczem `meta` leży coś, co nie jest poprawnym skarbcem: nie zakładamy nowego, żeby go nie nadpisać. */
  corrupt: boolean;
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

/** Najniższy numer formatu, który wymaga zapisu v2 (V-3): dopiero gdy wszystkie widziane urządzenia go znają. */
export const NOTE_FORMAT_V2_SCHEMA = 2;

/** Zapis notatki skarbca: v2 (z epoką w AAD), gdy bramka wersji na to pozwala; inaczej v1 dla starszych urządzeń. */
/** Metadane notatki do szyfrogramu (krok 3): tylko te, które notatka ma. */
function privateMetaOf(n: Partial<Pick<Note, "color" | "folderId" | "parentId" | "icon">>): PrivateMeta | undefined {
  const meta: PrivateMeta = {};
  if (n.color !== undefined) meta.color = n.color;
  if (n.folderId !== undefined) meta.folderId = n.folderId;
  if (n.parentId !== undefined) meta.parentId = n.parentId;
  if (n.icon !== undefined) meta.icon = n.icon;
  return Object.keys(meta).length ? meta : undefined;
}

function encryptNoteWrite(key: CryptoKey, json: string, id: string, epoch: number): Promise<string> {
  return writeFormatAllowed(NOTE_FORMAT_V2_SCHEMA) ? encryptNoteStringV2(key, json, id, epoch) : encryptString(key, json, noteAad(id));
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
  } catch (err) {
    // Uszkodzony licznik prób zeruje ochronę przed zgadywaniem hasła — musi zostawić ślad.
    logDiag("warn", "vault", "uszkodzony licznik prób", err);
  }
  return { fails: 0, until: 0 };
}

function writeThrottle(v: { fails: number; until: number } | null) {
  try {
    if (v && v.fails > 0) localStorage.setItem(THROTTLE_KEY, JSON.stringify(v));
    else localStorage.removeItem(THROTTLE_KEY);
  } catch { /* brak miejsca — limit działa tylko w pamięci karty */ }
}


/** Metadane z treści szyfrogramu: tylko znane pola we właściwych typach; brak pól = undefined. */
function cleanPrivateMeta(raw: unknown): PrivateMeta | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const meta: PrivateMeta = {};
  if (typeof r.color === "string" && (NOTE_COLORS as readonly string[]).includes(r.color)) meta.color = r.color as Note["color"];
  if (r.folderId === null || (typeof r.folderId === "string" && r.folderId.length <= 200)) meta.folderId = r.folderId as string | null;
  if (typeof r.parentId === "string" && r.parentId.length <= 200) meta.parentId = r.parentId;
  if (typeof r.icon === "string" && r.icon.length <= 32) meta.icon = r.icon;
  return Object.keys(meta).length ? meta : undefined;
}

function parseContent(json: string): PrivateContent {
  const raw = JSON.parse(json) as Partial<PrivateContent> | null;
  if (!raw || typeof raw !== "object") throw new VaultError("bad-format");
  const checklist = Array.isArray(raw.checklist)
    ? raw.checklist
      .filter((i): i is ChecklistItem => !!i && typeof i === "object" && typeof (i as ChecklistItem).id === "string")
      .map((i) => ({ id: i.id, text: typeof i.text === "string" ? i.text : "", checked: Boolean(i.checked), ...(i.indent === 1 ? { indent: 1 as const } : {}) }))
    : [];
  const meta = cleanPrivateMeta(raw.meta);
  return {
    title: typeof raw.title === "string" ? raw.title : "",
    content: typeof raw.content === "string" ? raw.content : "",
    checklist,
    labels: Array.isArray(raw.labels) ? raw.labels.filter((l): l is string => typeof l === "string") : [],
    ...(meta ? { meta } : {}),
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
  /** Odcisk metadanych, z którymi odblokowano sesję. Sam `epoch` nie wystarcza: dwa urządzenia zakładające skarbiec offline mają oba epoch 1. */
  let sessionFingerprint = "";
  let locking = false;
  let version = 0;
  let snapshot: VaultSnapshot = { phase: "none", corrupt: false, version: 0 };
  const cache = new Map<string, Entry>();
  /** Id notatek, których szyfrogramu nie da się odszyfrować tym kluczem. */
  const failed = new Set<string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const decrypting = new Map<string, Promise<void>>();
  const listeners = new Set<() => void>();
  let chain: Promise<void> = Promise.resolve();
  let compactTimer: ReturnType<typeof setTimeout> | null = null;

  let rejectedMetaLogged = false;
  const fingerprint = (m: VaultMeta) => [m.epoch, m.salt, m.wrapped, m.check].join("|");

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

  function isCorrupt(): boolean {
    const raw = store.getVaultMeta();
    return raw !== undefined && raw !== null && !isValidMeta(raw);
  }

  function emit() {
    version++;
    snapshot = { phase: phase(), corrupt: isCorrupt(), version };
    listeners.forEach((l) => l());
  }
  snapshot = { phase: phase(), corrupt: isCorrupt(), version };

  // Metadane zmienione z zewnątrz (sync): pojawił się skarbiec albo hasło zmieniono na innym urządzeniu.
  // Porównujemy cały odcisk (sól, klucz opakowany, kod sprawdzający), nie tylko epoch — przy równoległym
  // zakładaniu skarbca offline oba urządzenia mają epoch 1, a klucz tego przegranego przestałby pasować.
  store.observeVaultMeta(() => {
    const m = meta();
    if (key && (!m || m.epoch !== sessionEpoch || (sessionFingerprint !== "" && fingerprint(m) !== sessionFingerprint))) void lock();
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
      return false;
    }
    const next: PrivateContent = { ...entry.content };
    if (fields.title !== undefined) next.title = fields.title;
    if (fields.content !== undefined) next.content = fields.content;
    if (fields.checklist !== undefined) next.checklist = fields.checklist.map((i) => ({ ...i }));
    if (fields.labels !== undefined) next.labels = fields.labels.slice();
    const meta: PrivateMeta = { ...entry.content.meta };
    for (const f of ["color", "folderId", "parentId", "icon"] as const) {
      if (f in fields) (meta as Record<string, unknown>)[f] = fields[f];
    }
    if (Object.keys(meta).length) next.meta = meta;
    cache.set(id, { ...entry, content: next, dirty: true });
    schedule(id);
    emit();
    return true;
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
      const token = await encryptNoteWrite(k, JSON.stringify(content), id, sessionEpoch);
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
      const plain = await decryptNoteString(k, token, id, sessionEpoch);
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
    const current = meta();
    sessionFingerprint = current ? fingerprint(current) : "";
    locking = false;
    failed.clear();
    await decryptAll();
    await migrateToV2();
    emit();
  }

  /**
   * Przegląd V-3, punkt 3: stare szyfrogramy v1, których nikt nie edytował, przechodzą na v2 przy odblokowaniu,
   * ale tylko gdy bramka schematu na to pozwala. Błąd zostawia v1 (następne odblokowanie spróbuje ponownie).
   */
  async function migrateToV2(): Promise<void> {
    if (!key || !writeFormatAllowed(NOTE_FORMAT_V2_SCHEMA)) return;
    for (const [id, entry] of [...cache]) {
      if (entry.dirty || !entry.vault.startsWith("v1.") || !store.isLocked(id)) continue;
      try {
        const token = await encryptNoteStringV2(key, JSON.stringify(entry.content), id, sessionEpoch);
        // Przegląd V-3 (M-2): podczas szyfrowania notatkę mogła zmienić edycja albo zdalne urządzenie.
        // Zapisujemy tylko, gdy wpis w cache jest ten sam, niebrudny, a dokument nadal ma poprzedni szyfrogram (CAS).
        if (cache.get(id) !== entry || entry.dirty || store.getVault(id) !== entry.vault) continue;
        if (store.setVault(id, token, false)) cache.set(id, { ...entry, vault: token });
      } catch {
        // zostaje v1
      }
    }
  }

  // ── cykl życia ──────────────────────────────────────────────────────────────

  /** Pierwsze użycie: zakłada skarbiec. Zwraca kod awaryjny (pokazać raz) albo `null`. */
  async function setup(password: string, { withRecovery = true }: { withRecovery?: boolean } = {}): Promise<{ recoveryCode: string | null }> {
    // Surowa wartość pod kluczem (także zepsuta) blokuje zapis. Inaczej uszkodzone meta zostałyby nadpisane
    // i notatki prywatne straciłyby klucz (przegląd V-4, M-3).
    if (store.getVaultMeta() !== undefined && store.getVaultMeta() !== null) {
      throw new Error(meta() ? "Skarbiec już istnieje — odblokuj go" : "Skarbiec w dokumencie jest uszkodzony — nie nadpisano go");
    }
    const created = await createVault(password, { iterations, withRecovery });
    store.setVaultMeta(created.meta);
    writeVaultPin(created.meta);
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
    await adoptVerifiedMeta(k, m, true);
  }

  /**
   * Przegląd V-3, W-1: metadane w dokumencie są niezaufane. Przed przyjęciem sprawdzamy lokalny pin:
   * tylko-epoka → odrzucamy (nie da się tego wytłumaczyć zmianą hasła); zmienione opakowanie przy poprawnym
   * haśle → przyjmujemy i informujemy (zwykła zmiana hasła na innym urządzeniu). Po przyjęciu pin się aktualizuje.
   */
  async function adoptVerifiedMeta(k: CryptoKey, m: VaultMeta, provedSecret: boolean): Promise<void> {
    const verdict = comparePin(readVaultPin(), m);
    if (verdict === "epoch-only") {
      logSecurity("vault-meta-rejected", "epoch changed in the document without a key change — refused");
      throw new VaultError("bad-format", "Skarbiec w dokumencie ma inny numer epoki niż ten, który zna to urządzenie. Nie odblokowano.");
    }
    // Biometria dowodzi tylko posiadania klucza, nie hasła. Zmianę w dokumencie przyjmujemy wyłącznie po haśle
    // albo kodzie awaryjnym (przegląd V-4, M-2).
    if (verdict === "changed" && !provedSecret) {
      logSecurity("vault-meta-rejected", "changed meta refused on biometric unlock");
      throw new VaultError("bad-format", "Skarbiec został zmieniony na innym urządzeniu. Odblokuj hasłem, aby przyjąć zmianę.");
    }
    if (verdict === "changed") toast.info("Skarbiec w dokumencie różni się od zapisanego na tym urządzeniu — odblokowano Twoim hasłem");
    await adoptKey(k, m.epoch);
    writeVaultPin(m);
  }

  /** Czy skarbiec ma zapisany choć jeden passkey (V-4). */
  function hasPasskeys(): boolean {
    return (meta()?.passkeys?.entries.length ?? 0) > 0;
  }

  /**
   * Dodaje odblokowanie biometrią (V-4). Wymaga hasła, bo surowy klucz danych jest dostępny tylko po jego sprawdzeniu.
   * Nowe opakowanie dopisuje się obok istniejących; hasło i kod awaryjny działają dalej. Epoka się nie zmienia.
   */
  async function addPasskey(password: string, userName: string): Promise<void> {
    const m = meta();
    if (!m) throw new Error("Brak skarbca");
    const entries = m.passkeys?.entries ?? [];
    if (entries.length >= MAX_PASSKEYS) throw new Error("Osiągnięto limit odblokowań biometrią");
    // Przegląd V-4, H-1: dwa prompty WebAuthn trwają długo. Jeśli w tym czasie meta się zmieni (np. zmiana hasła
    // z innego urządzenia), zapis cofnąłby skarbiec do starego klucza — notatki nie dałyby się odblokować.
    // Zmiana samej epoki w dokumencie nie jest przyjmowana, także przy zapisie pinu (przegląd V-4).
    if (comparePin(readVaultPin(), m) === "epoch-only") {
      throw new VaultError("bad-format", "Skarbiec w dokumencie ma inny numer epoki niż ten, który zna to urządzenie. Nie dodano biometrii.");
    }
    const startJson = JSON.stringify(m);
    const raw = await unwrapRawWithPassword(m, password, minIterations);
    try {
      const salt = m.passkeys?.salt ?? toB64u(crypto.getRandomValues(new Uint8Array(32)));
      const { id, prf } = await registerPasskey(userName, fromB64u(salt));
      const wrapped = await wrapDataKeyForPasskey(raw, prf).finally(() => prf.fill(0));
      // Sprawdzenie i zapis bez await między nimi: zdalna zmiana meta nie wejdzie w środku.
      if (JSON.stringify(store.getVaultMeta()) !== startJson) {
        throw new Error("Skarbiec zmienił się w trakcie dodawania biometrii — spróbuj ponownie");
      }
      const next: VaultMeta = { ...m, passkeys: { salt, entries: [...entries.filter((e) => e.id !== id), { id, wrapped }] } };
      store.setVaultMeta(next);
      writeVaultPin(next);
    } finally {
      raw.fill(0);
    }
  }

  /** Odblokowanie passkeyem (V-4): ten sam pin i migracja co przy haśle. */
  async function unlockWithPasskey(): Promise<void> {
    const m = meta();
    if (!m || !m.passkeys?.entries.length) throw new Error("Brak odblokowania biometrią");
    checkThrottle();
    const { id, prf } = await assertPasskey(m.passkeys.entries.map((e) => e.id), fromB64u(m.passkeys.salt));
    let k: CryptoKey;
    try {
      k = await unlockKeyWithPasskey(m, id, prf);
    } catch (err) {
      recordFailure("vault-unlock-failed");
      throw err;
    } finally {
      prf.fill(0);
    }
    recordSuccess();
    await adoptVerifiedMeta(k, m, false);
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
    await adoptVerifiedMeta(k, m, true);
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
        const meta = writeFormatAllowed(METADATA_IN_CIPHERTEXT_SCHEMA) ? privateMetaOf(plain) : undefined;
        const content: PrivateContent = { title: plain.title, content: plain.content, checklist: plain.checklist, labels: plain.labels, ...(meta ? { meta } : {}) };
        const json = JSON.stringify(content);
        const token = await encryptNoteWrite(k, json, id, sessionEpoch);
        // Edytor mógł zatwierdzić szkic w trakcie szyfrowania — wtedy powtarzamy.
        const again = store.readPlainNote(id);
        const againMeta = writeFormatAllowed(METADATA_IN_CIPHERTEXT_SCHEMA) && again ? privateMetaOf(again) : undefined;
        if (!again || JSON.stringify({ title: again.title, content: again.content, checklist: again.checklist, labels: again.labels, ...(againMeta ? { meta: againMeta } : {}) }) !== json) continue;
        if (!store.lockNote(id, token, writeFormatAllowed(METADATA_IN_CIPHERTEXT_SCHEMA))) return { ok: false, reason: "missing" };
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
    const ok = store.unlockNote(id, { ...entry.content, ...(entry.content.meta ?? {}) });
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
    const token = await encryptNoteWrite(k, JSON.stringify(content), newId, sessionEpoch);
    const t = now();
    const { dailyDate: _daily, periodKey: _period, ...rest } = original;
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
      try { plain.set(id, { expected: token, json: await decryptNoteString(oldKey, token, id, sessionEpoch) }); } catch { skipped.push(id); }
    }
    const created = await createVault(newPassword, { iterations, withRecovery, epoch: m.epoch + 1 });
    const next = new Map<string, { expected: string; vault: string }>();
    for (const [id, p] of plain) next.set(id, { expected: p.expected, vault: await encryptNoteWrite(created.dataKey, p.json, id, created.meta.epoch) });
    // Zmiana w trakcie (np. edycja z innego urządzenia) — przerywamy bez zapisu.
    if (!store.rekeyVault(created.meta, next)) throw new Error("Notatki zmieniły się w trakcie zmiany hasła — spróbuj ponownie");
    writeVaultPin(created.meta);
    key = created.dataKey;
    sessionEpoch = created.meta.epoch;
    sessionFingerprint = fingerprint(created.meta);
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
    setup, unlock, unlockWithRecoveryCode, unlockWithPasskey, addPasskey, hasPasskeys, lock, flush,
    lockNote, removeLock, duplicate, changePassword, resetPasswordWithRecovery,
    retryInMs,
  };
}

export type PrivateNotes = ReturnType<typeof createPrivateNotes>;

export const privateNotes = createPrivateNotes(defaultStore);
