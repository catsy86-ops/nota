import { dniPl } from "@/lib/plural";

/** Po ilu dniach bez kopii pełnej zdjęcia budowy uznajemy za zagrożone (plan B1.7). */
export const BACKUP_STALE_DAYS = 7;

export interface StorageStatus {
  /** Tekst do karty budowy. */
  text: string;
  /** Zdjęcia są zagrożone: brak kopii, kopia stara albo przeglądarka może wyczyścić dane. */
  warn: boolean;
}

/**
 * Gdzie są zdjęcia budowy: tylko w pamięci telefonu (do `persisted` przeglądarka może je usunąć przy braku miejsca)
 * i w ostatniej kopii pełnej. `days` = dni od ostatniej kopii (`daysSinceBackup`), `null` = nigdy.
 */
export function storageStatus(days: number | null, persisted: boolean | null): StorageStatus {
  const age = days === null ? "kopii pełnej jeszcze nie zrobiono" : days <= 0 ? "kopia pełna: dziś" : `kopia pełna: ${dniPl(days)} temu`;
  const stale = days === null || days > BACKUP_STALE_DAYS;
  if (persisted === false) return { text: `${age}; przeglądarka może usunąć dane przy braku miejsca`, warn: true };
  return { text: age, warn: stale };
}
