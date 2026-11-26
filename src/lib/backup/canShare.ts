/** Udostępnianie pliku kopii działa tylko tam, gdzie przeglądarka umie wysłać plik (telefon). Osobno, żeby paleta nie ładowała kodu kopii. */
export function canShareBackupFile(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [new File(["{}"], "kopia.json", { type: "application/json" })] });
  } catch {
    return false;
  }
}
