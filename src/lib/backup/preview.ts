import type { FullBackup } from "@/lib/noteSchema";
import { pluralPl } from "@/lib/plural";

/** Liczby do podglądu kopii przed przywróceniem (U3.2); `undefined` = sekcji nie ma w pliku albo jest nieczytelna. */
export interface BackupPreview {
  notes: number;
  folders: number;
  /** Wpisy dziennika Pracy. */
  journal?: number;
  /** Budowy (karty) w Pracy. */
  sites?: number;
  /** Dni wpisane w głównym Grafiku. */
  shiftDays?: number;
  debts?: number;
  appVersion?: string;
}

/** Surowa sekcja kopii to JSON w napisie; zły JSON nie przerywa podglądu — tę sekcję i tak zgłosi przywracanie. */
function parseSection(raw: string | undefined): unknown {
  if (typeof raw !== "string") return undefined;
  try { return JSON.parse(raw); } catch { return undefined; }
}

const countKeys = (v: unknown): number | undefined =>
  v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v).length : undefined;

export function backupPreview(backup: FullBackup): BackupPreview {
  const study = parseSection(backup.study) as { journal?: unknown; sites?: unknown } | undefined;
  const shifts = parseSection(backup.shifts) as { days?: unknown } | undefined;
  const debts = parseSection(backup.debts);
  return {
    notes: backup.notes.length,
    folders: backup.folders.length,
    ...(Array.isArray(study?.journal) ? { journal: study.journal.length } : {}),
    ...(countKeys(study?.sites) !== undefined ? { sites: countKeys(study?.sites) } : {}),
    ...(countKeys(shifts?.days) !== undefined ? { shiftDays: countKeys(shifts?.days) } : {}),
    ...(Array.isArray(debts) ? { debts: debts.length } : {}),
    ...(backup.appVersion ? { appVersion: backup.appVersion } : {}),
  };
}

/** Jedno zdanie z liczbami: „12 notatek, 2 foldery, 40 wpisów dziennika na 3 budowach, 61 dni Grafiku, 4 długi”. */
export function describeBackupPreview(p: BackupPreview): string {
  const parts = [
    `${p.notes} ${pluralPl(p.notes, ["notatka", "notatki", "notatek"])}`,
    `${p.folders} ${pluralPl(p.folders, ["folder", "foldery", "folderów"])}`,
  ];
  if (p.journal !== undefined && (p.journal > 0 || (p.sites ?? 0) > 0)) {
    const sites = p.sites ? ` na ${p.sites} ${pluralPl(p.sites, ["budowie", "budowach", "budowach"])}` : "";
    parts.push(`${p.journal} ${pluralPl(p.journal, ["wpis", "wpisy", "wpisów"])} dziennika${sites}`);
  }
  if (p.shiftDays) parts.push(`${p.shiftDays} ${pluralPl(p.shiftDays, ["dzień", "dni", "dni"])} Grafiku`);
  if (p.debts) parts.push(`${p.debts} ${pluralPl(p.debts, ["dług", "długi", "długów"])}`);
  return parts.join(", ");
}
