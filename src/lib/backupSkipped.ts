import type { BackupSkipped } from "@/lib/noteSchema";

/** Zdanie do okna przywracania: czego w tym pliku nie ma. `null`, gdy plik jest kompletny. */
export function describeBackupSkipped(s?: BackupSkipped): string | null {
  if (!s) return null;
  const parts: string[] = [];
  if (s.tooLarge) parts.push(`załączniki za duże na backup: ${s.tooLarge}`);
  if (s.missing) parts.push(`załączniki nieobecne na urządzeniu, z którego zrobiono kopię: ${s.missing}`);
  if (s.journalPhotos) parts.push(`zdjęcia dziennika z budowy: ${s.journalPhotos}`);
  if (s.siteDocs) parts.push(`pliki budów (plany, PDF): ${s.siteDocs}`);
  if (s.recordings) parts.push(`nagrania głosowe z wpisów: ${s.recordings}`);
  if (!parts.length) return null;
  const onlyHere = s.recordings
    ? " Zdjęcia, nagrania i pliki budów zostały tylko na tamtym urządzeniu."
    : s.journalPhotos || s.siteDocs ? " Zdjęcia dziennika i pliki budów zostały tylko na tamtym urządzeniu." : "";
  return `Ten plik nie zawiera: ${parts.join(", ")}.${onlyHere}`;
}
