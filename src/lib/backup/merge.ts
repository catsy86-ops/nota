import type { FullBackup } from "@/lib/noteSchema";
import { yjsStore } from "@/lib/yjsStore";
import { isValidMeta } from "@/lib/vault";
import { versionsStore } from "@/lib/versionsStore";
import { logDiag } from "@/lib/diagnostics";
import { imageStore } from "@/lib/imageStore";
import { STUDY_STORAGE_KEY } from "@/lib/study/keys";
import { restoreExtraSchedule, restoreShifts, shiftsReady } from "@/lib/shifts/store";
import { migrate } from "@/lib/shifts/model";
import { PUSH_PREFS_KEY, type PushPrefs } from "@/lib/push/prefs";
import { PRACA } from "@/lib/storage/keys";
import { withExclusiveLock, MIGRATION_LOCK } from "@/lib/tabLock";
import { clearRestoreMarker, setRestoreMarker } from "@/lib/restoreMarker";
import { yieldToMain } from "@/lib/yieldToMain";
import { MERGE_SECTIONS, SHIFTS_SECTION, STUDY_SECTION, type Merge, type MergeKey } from "./sections";
import { ACHIEVEMENTS_KEY, SETTINGS_KEYS, SETTING_VALUE_MAX, withStoredImages } from "./build";

const PUSH_RESTORE_KEY = PUSH_PREFS_KEY;

/**
 * Przywracanie ustawień push: push się wyłącza (subskrypcja i „ostatnio wysłane” należą do przeglądarki, na której
 * była kopia — nie do nowego telefonu), a adres serwera się zeruje. Złośliwa kopia mogłaby wskazać serwer atakującego,
 * a użytkownik wpisałby tam swój token; adres wpisuje się więc od nowa, razem z tokenem.
 */
export function pushPrefsForRestore(raw: string): string {
  try {
    const p = JSON.parse(raw) as Partial<PushPrefs>;
    const off = Array.isArray(p.off) ? p.off.filter((x): x is string => typeof x === "string") : [];
    return JSON.stringify({ server: "", enabled: false, off });
  } catch {
    return JSON.stringify({ server: "", enabled: false, off: [] });
  }
}

export interface RestoreOptions {
  versions: boolean; settings: boolean; achievements: boolean; shifts: boolean; study: boolean;
  /** Sekcje (etykiety), które użytkownik kazał pominąć po zgłoszeniu `RestoreCheckError` („Przywróć bez niej”). */
  skip?: readonly string[];
}

/**
 * Uszkodzone sekcje wykryte przy sprawdzaniu — **przed** pierwszym zapisem (Z-18.1, P1/P2 audytu 2). Dokument jest
 * nietknięty; wołający pyta „Przywróć bez niej / Anuluj” i woła ponownie z `skip`.
 */
export class RestoreCheckError extends Error {
  constructor(readonly sections: string[]) {
    super(`Uszkodzone części kopii: ${sections.join(", ")}`);
    this.name = "RestoreCheckError";
  }
}

/** L1: w dzienniku diagnostycznym zostaje tylko nazwa błędu — komunikat `JSON.parse` może zawierać fragment kopii. */
const errName = (e: unknown): string => (e instanceof Error ? e.name : "błąd");

/**
 * Co przywrócenie zastąpi, a co tylko uzupełni (P6 audytu 2, Z-18.3) — tekst okna liczony z tych samych list,
 * których używa `restoreFullBackup`, żeby nowa sekcja nie mogła zniknąć z ostrzeżenia.
 */
export function restoreScope(backup: Partial<Record<MergeKey, unknown>> & { shifts?: unknown; study?: unknown; settings?: Record<string, unknown> }, opts: RestoreOptions): { replaced: string[]; merged: string[] } {
  const replaced = ["notatki", "foldery", "etykiety"];
  if (opts.shifts && backup.shifts !== undefined) replaced.push(SHIFTS_SECTION);
  if (opts.study && (backup.study !== undefined || backup.settings?.[PRACA.store] !== undefined)) replaced.push(STUDY_SECTION);
  const merged = MERGE_SECTIONS.filter((sec) => backup[sec.key]).map((sec) => sec.label);
  return { replaced, merged };
}

/** Postęp wymiany notatek i przerwanie (Z-16.2): okno przywracania pokazuje „N z M” i „Przerwij”. */
export interface RestoreRun {
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export async function restoreFullBackup(backup: FullBackup, opts: RestoreOptions, run: RestoreRun = {}): Promise<{ studyDropped: number; schedulesSkipped: number; failed: string[] }> {
  // `ready()` samo bierze blokadę migracji — wołane w jej środku zakleszczyłoby się.
  await yjsStore.ready();
  return withExclusiveLock(MIGRATION_LOCK, () => restoreFullBackupLocked(backup, opts, run));
}

/**
 * Przywracanie w trzech fazach (Z-18.1, P1/P2 audytu 2):
 * 1. **Sprawdzanie, bez zapisu** — moduły działów, `JSON.parse` sekcji, `migrate` Grafiku, `cleanDump` Nauki, wersje.
 *    Uszkodzona sekcja → `RestoreCheckError` przed pierwszym zapisem (dawniej błąd wychodził po zniszczeniu notatek).
 * 2. **Zapis** — notatki porcjami (`replaceAllChunked`, Z-16.2): najpierw wstawianie (stan pośredni to nadzbiór), potem
 *    jedna transakcja końcowa z usunięciem starych notatek i z metadanymi skarbca — przerwanie zostawia stare notatki
 *    prywatne czytelne starym hasłem, nigdy odwrotnie. Dalej sekcje działów, Grafik, Nauka, z oddaniem wątku między nimi.
 *    Pełną atomowość da dopiero ścieżka awaryjna Q1.4; znacznik zamienia przerwanie w komunikat.
 * 3. **Zapisy asynchroniczne** na końcu — wersje, `localStorage`; potem zdjęcie znacznika.
 */
async function restoreFullBackupLocked(backup: FullBackup, opts: RestoreOptions, run: RestoreRun): Promise<{ studyDropped: number; schedulesSkipped: number; failed: string[] }> {
  const skip = new Set(opts.skip ?? []);
  /** Sekcje, których nie udało się przywrócić (W8): wołający pokazuje je zamiast „Przywrócono”. */
  const failed: string[] = [];
  const fail = (name: string, err: unknown) => { failed.push(name); logDiag("warn", "backup", `cannot restore ${name}`, errName(err)); };
  const broken: string[] = [];
  const check = <T>(name: string, fn: () => T): T | undefined => {
    try { return fn(); } catch (err) { broken.push(name); logDiag("warn", "backup", `broken section ${name}`, errName(err)); return undefined; }
  };
  let studyDropped = 0;
  let schedulesSkipped = 0;
  await yjsStore.ready();

  // ── 1. sprawdzanie ──
  const merges: { label: string; apply: () => unknown }[] = [];
  for (const sec of MERGE_SECTIONS) {
    const raw = backup[sec.key];
    if (!raw || skip.has(sec.label)) continue;
    const dump = check(sec.label, () => JSON.parse(raw) as unknown);
    if (dump === undefined) continue;
    let merge: Merge;
    try { merge = await sec.load(); } catch (err) { broken.push(sec.label); logDiag("warn", "backup", `cannot load ${sec.label}`, errName(err)); continue; }
    merges.push({ label: sec.label, apply: () => merge(dump as never) });
  }

  let shiftsApply: (() => void) | null = null;
  if (opts.shifts && backup.shifts !== undefined && !skip.has(SHIFTS_SECTION)) {
    await shiftsReady();
    const main = check(SHIFTS_SECTION, () => {
      const raw = JSON.parse(backup.shifts!);
      // M8: bez pola `bonuses` (kopia sprzed premii) premie z tego telefonu zostają.
      return { data: migrate(raw), bonuses: Array.isArray(raw?.bonuses) };
    });
    // M4: dodatkowe grafiki — każdy osobno; odrzucone (limit, zły id, zły kształt) są liczone i zgłaszane.
    const extra: { id: string; name: string; data: ReturnType<typeof migrate> }[] = [];
    try {
      const list = backup.shiftSchedules ? JSON.parse(backup.shiftSchedules) as { id: string; name: string; data: unknown }[] : [];
      for (const s of Array.isArray(list) ? list : []) {
        try {
          if (typeof s?.id !== "string" || typeof s?.name !== "string") schedulesSkipped++;
          else extra.push({ id: s.id, name: s.name, data: migrate(s.data) });
        } catch (err) { schedulesSkipped++; logDiag("warn", "backup", "cannot restore schedule", errName(err)); }
      }
    } catch (err) { logDiag("warn", "backup", "cannot read schedules", errName(err)); }
    if (main) {
      shiftsApply = () => {
        restoreShifts(main.data, main.bonuses);
        for (const s of extra) if (!restoreExtraSchedule(s.id, s.name, s.data)) schedulesSkipped++;
      };
    }
  }

  let studyApply: (() => void) | null = null;
  const legacyStudy = backup.settings?.[STUDY_STORAGE_KEY];
  if (opts.study && (backup.study !== undefined || legacyStudy !== undefined) && !skip.has(STUDY_SECTION)) {
    try {
      const [{ studyDevice, studyReady, yStudy }, { cleanDump, dumpFromLegacy }] = await Promise.all([import("@/lib/study/data"), import("@/lib/study/yStudy")]);
      await studyReady();
      const dump = check(STUDY_SECTION, () => {
        // Starsze kopie niosą Naukę tylko wśród ustawień, w kształcie dawnego zapisu.
        const raw = backup.study !== undefined ? JSON.parse(backup.study) : null;
        const d = raw !== null ? cleanDump(raw) : dumpFromLegacy(JSON.parse(legacyStudy!), studyDevice());
        // Wpisy nieznanego rodzaju albo z uszkodzonymi polami odpadają przy czyszczeniu — zostawiamy ślad, zamiast gubić je po cichu.
        const rawCount = raw && Array.isArray(raw.journal) ? raw.journal.length : d.journal.length;
        if (rawCount > d.journal.length) {
          studyDropped = rawCount - d.journal.length;
          logDiag("warn", "backup", `przywracanie Nauki: pominięto ${studyDropped} wpisów`);
        }
        return d;
      });
      if (dump) studyApply = () => yStudy.replaceAll(dump);
    } catch (err) { broken.push(STUDY_SECTION); logDiag("warn", "backup", "cannot load study", errName(err)); }
  }

  if (opts.versions && backup.versions) await versionsStore.load();
  const writes: Record<string, string> = {};
  if (opts.settings && backup.settings) {
    for (const k of SETTINGS_KEYS) {
      if (!(k in backup.settings)) continue;
      const value = backup.settings[k];
      // Obca kopia nie wypełni localStorage jedną wartością (S15 audytu); uczciwe ustawienia są dużo mniejsze.
      if (typeof value !== "string" || value.length > SETTING_VALUE_MAX) { logDiag("warn", "backup", `pominięto ustawienie ${k}: zła wartość`); continue; }
      writes[k] = k === PUSH_RESTORE_KEY ? pushPrefsForRestore(value) : value;
    }
  }
  if (opts.achievements && backup.achievements !== undefined) writes[ACHIEVEMENTS_KEY] = backup.achievements;

  if (broken.length) throw new RestoreCheckError(broken);

  // Obrazy i załączniki: tylko dokładają do magazynu; błąd zapisu (brak miejsca) przerywa przed wymianą notatek.
  const notes = await withStoredImages(backup.notes);
  if (backup.attachmentBlobs) await imageStore.ingest(Object.values(backup.attachmentBlobs));

  // ── 2. zapis ──
  setRestoreMarker({ startedAt: Date.now(), exportedAt: backup.exportedAt });
  const vault = backup.vault;
  try {
    await yjsStore.replaceAllChunked(notes, backup.folders, backup.labels, backup.propDefs ?? [], {
      onProgress: run.onProgress,
      signal: run.signal,
      // Metadane skarbca w transakcji końcowej, razem z usunięciem starych notatek (Z-16.2, uwaga do P1).
      final: isValidMeta(vault) ? () => yjsStore.setVaultMeta(vault) : undefined,
    });
  } catch (err) {
    // „Przerwij”: zostaje nadzbiór (stare notatki i część z kopii), nic nie usunięto — to świadomy stan, nie przerwanie.
    if (err instanceof DOMException && err.name === "AbortError") clearRestoreMarker();
    throw err;
  }
  for (const m of merges) {
    try { m.apply(); } catch (err) { fail(m.label, err); }
    await yieldToMain();
  }
  if (shiftsApply) { try { shiftsApply(); } catch (err) { fail(SHIFTS_SECTION, err); } }
  await yieldToMain();
  if (studyApply) { try { studyApply(); } catch (err) { fail(STUDY_SECTION, err); } }
  if (schedulesSkipped) logDiag("warn", "backup", `przywracanie grafików: pominięto ${schedulesSkipped}`);

  // ── 3. zapisy asynchroniczne ──
  if (opts.versions && backup.versions) {
    versionsStore.replaceAll(backup.versions);
    await versionsStore.flush();
  }
  for (const [k, v] of Object.entries(writes)) {
    try { localStorage.setItem(k, v); } catch (err) { logDiag("warn", "backup", `cannot restore ${k}`, err); }
  }
  // Kopia sprzed 4.1 niesie cenniki wśród ustawień (stare klucze): wchodzą do dokumentu i znikają z localStorage.
  if (opts.settings && backup.settings && (PRACA.pricing in backup.settings || PRACA.prices in backup.settings)) {
    await import("@/lib/study/pricingStore").then((m) => m.importLegacyPricing()).catch((err) => fail("Cenniki", err));
  }
  clearRestoreMarker();
  return { studyDropped, schedulesSkipped, failed };
}
