import { SCHEMA_VERSION } from "@/lib/formatSchema";
// Schematy (zod) ładują się dopiero przy imporcie/backupie — nie ma ich w startowym bundlu.
import type { FullBackup } from "@/lib/noteSchema";
import { APP_NAME } from "@/lib/appName";
import { MERGE_SECTIONS, SHIFTS_SECTION, STUDY_SECTION } from "./sections";

export const loadSchemas = () => import("@/lib/noteSchema");

// Załączniki (do 40 MB surowych, ~53 MB jako base64) mieszczą się obok notatek i obrazów.
export const MAX_IMPORT_FILE_SIZE = 120 * 1024 * 1024; // 120 MB

/** Kopia większa niż limit wczytywania nie da się przywrócić — trzeba ostrzec przy zapisie, nie przy awarii (W13). */
export const isBackupOversize = (bytes: number): boolean => bytes > MAX_IMPORT_FILE_SIZE;
export const BACKUP_OVERSIZE_NOTE = `Kopia jest większa niż ${MAX_IMPORT_FILE_SIZE / (1024 * 1024)} MB, więc aplikacja nie da rady jej wczytać. Zmniejsz załączniki albo zdjęcia (Praca → zmniejsz zdjęcia) i zrób kopię jeszcze raz.`;

/** Najwyższa wersja kopii, którą ta aplikacja umie wczytać; nowsza ma sekcje, które po cichu by zgubiła. */
export const MAX_BACKUP_VERSION = 3;

export async function parseFullBackup(text: string): Promise<FullBackup> {
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as Record<string, unknown>).notes)) {
    throw new Error(`To nie jest plik pełnego backupu aplikacji ${APP_NAME}`);
  }
  const obj = raw as Record<string, unknown>;
  const { version, schema } = obj;
  // D5.3: nowsza koperta albo nowszy format dokumentu — odmowa bez częściowego importu.
  if ((typeof version === "number" && version > MAX_BACKUP_VERSION) || (typeof schema === "number" && schema > SCHEMA_VERSION)) {
    throw new Error("Ta kopia pochodzi z nowszej wersji aplikacji. Zaktualizuj aplikację i spróbuj ponownie.");
  }
  // P4 audytu 2: `version: "4"` przechodziło przez `catch` jako 1. Brak wersji to najstarsza kopia; zła wartość — odmowa.
  if (version !== undefined && !(typeof version === "number" && Number.isInteger(version) && version >= 1)) {
    throw new Error("Ta kopia ma nieznaną wersję formatu. Nie wczytam jej, żeby nie zgubić części danych.");
  }
  const { fullBackupSchema, FULL_BACKUP_KEYS } = await loadSchemas();
  const backup = fullBackupSchema.parse(raw);
  ISSUES.set(backup, findIssues(obj, backup as unknown as Record<string, unknown>, FULL_BACKUP_KEYS));
  return backup;
}

/** Części kopii, których przywracanie nie odtworzy (Z-18.2) — do pokazania przed „Przywróć”. */
export interface BackupIssues {
  /** Sekcje z nowszej wersji aplikacji (klucz w pliku albo na liście `sections`, którego ta wersja nie zna). */
  unknown: string[];
  /** Sekcje obecne w pliku, które po sprawdzeniu schematem zniknęły (zły typ — ręcznie poprawiony plik, błąd eksportu). */
  corrupt: string[];
  /** Wersja aplikacji, która zrobiła kopię, jeśli ją zapisała. */
  appVersion?: string;
}

const ISSUES = new WeakMap<FullBackup, BackupIssues>();
const NO_ISSUES: BackupIssues = { unknown: [], corrupt: [] };

/** Raport dla kopii z `parseFullBackup`; kopia zbudowana w pamięci (np. migawka dnia) nie ma uwag. */
export const backupIssues = (backup: FullBackup): BackupIssues => ISSUES.get(backup) ?? NO_ISSUES;

function findIssues(raw: Record<string, unknown>, parsed: Record<string, unknown>, known: readonly string[]): BackupIssues {
  const knownSet = new Set(known);
  const listed = Array.isArray(raw.sections) ? raw.sections.filter((s): s is string => typeof s === "string") : [];
  const unknown = [...new Set([...Object.keys(raw), ...listed])].filter((k) => !knownSet.has(k)).slice(0, 20);
  // `labels` po błędzie schematu staje się pustą tablicą, reszta opcjonalnych sekcji — brakiem.
  const corrupt = known.filter((k) => raw[k] !== undefined && raw[k] !== null
    && (parsed[k] === undefined || (k === "labels" && !Array.isArray(raw[k]))));
  return { unknown, corrupt, ...(typeof parsed.appVersion === "string" ? { appVersion: parsed.appVersion } : {}) };
}

/** Nazwy sekcji dla ludzi; nieznane (z nowszej wersji) zostają kluczem z pliku — innej nazwy nie mamy. */
const SECTION_LABEL: Readonly<Record<string, string>> = {
  labels: "Etykiety", folders: "Foldery", versions: "Historia wersji", settings: "Ustawienia", achievements: "Odznaki i passa",
  shifts: SHIFTS_SECTION, shiftSchedules: SHIFTS_SECTION, study: STUDY_SECTION, attachmentBlobs: "Załączniki",
  ...Object.fromEntries(MERGE_SECTIONS.map((s) => [s.key, s.label])),
};

/** Zdania ostrzeżenia przed przywróceniem (Z-18.2); pusta lista = nic nie przepadnie po cichu. */
export function describeBackupIssues(issues: BackupIssues): string[] {
  const out: string[] = [];
  if (issues.unknown.length) {
    const from = issues.appVersion ? ` (${issues.appVersion})` : "";
    out.push(`Ta kopia pochodzi z nowszej wersji aplikacji${from}. Sekcje, których ta wersja nie zna: ${issues.unknown.join(", ")} — nie zostaną przywrócone. Zaktualizuj aplikację albo przywróć bez nich.`);
  }
  if (issues.corrupt.length) out.push(`Uszkodzone w pliku, pominięte: ${issues.corrupt.map((k) => SECTION_LABEL[k] ?? k).join(", ")}.`);
  return out;
}
