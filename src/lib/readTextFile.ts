/** Pliki tekstowe do importu (.ics, .csv, .md) — większe niż to nie są kalendarzem ani listą pytań. */
export const MAX_TEXT_IMPORT_BYTES = 5 * 1024 * 1024;

/**
 * Czyta plik jako tekst, ale najpierw sprawdza rozmiar: `file.text()` na bardzo dużym
 * pliku zawiesza kartę. Za duży plik → `Error` z komunikatem dla użytkownika.
 */
export async function readTextFile(file: Blob & { name?: string }, max = MAX_TEXT_IMPORT_BYTES): Promise<string> {
  if (file.size > max) {
    const name = file.name ? `„${file.name}” ` : "";
    throw new Error(`Plik ${name}jest za duży (limit ${Math.round(max / (1024 * 1024))} MB).`);
  }
  return file.text();
}
