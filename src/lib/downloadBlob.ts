/** Po tylu ms zwalniamy adres `blob:` — przeglądarka musi zdążyć zacząć pobieranie. */
export const DOWNLOAD_REVOKE_MS = 10_000;

/**
 * Pobranie pliku przez ukryty link. Adres zwalniamy z opóźnieniem, nie od razu po `click()`:
 * Safari i część Androidów czyta blob asynchronicznie, a wczesne `revokeObjectURL` urywa pobieranie.
 */
export function downloadBlob(blob: Blob, filename: string): void {
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
