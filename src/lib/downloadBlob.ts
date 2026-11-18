import { isNativeShell } from "@/lib/native/platform";

/** Po tylu ms zwalniamy adres `blob:` — przeglądarka musi zdążyć zacząć pobieranie. */
export const DOWNLOAD_REVOKE_MS = 10_000;

/**
 * Pobranie pliku przez ukryty link. Adres zwalniamy z opóźnieniem, nie od razu po `click()`:
 * Safari i część Androidów czyta blob asynchronicznie, a wczesne `revokeObjectURL` urywa pobieranie.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  // Z-13.4: WebView w APK nie pobiera przez `<a download>` — plik idzie do arkusza udostępniania.
  if (isNativeShell()) {
    void import("@/lib/native/fileShare").then((m) => m.saveBlob(blob, filename)).catch(() => undefined);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_REVOKE_MS);
}

/** Pobranie tekstu jako pliku. Tu, nie w `exportNotes`, żeby drobne pobrania (kalendarz, Grafik, sync z pliku) nie wciągały eksportu do startu. */
export function download(content: string, filename: string, type: string): void {
  downloadBlob(new Blob([content], { type }), filename);
}
