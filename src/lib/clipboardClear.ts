/**
 * S1.9: po skopiowaniu sekretu (kod awaryjny skarbca) schowek jest czyszczony po `ms`, żeby kod nie leżał w historii
 * schowka i nie dał się wkleić gdzie indziej. Tam, gdzie przeglądarka już zgodziła się na odczyt, czyścimy tylko wtedy,
 * gdy w schowku nadal jest ten sam tekst; gdzie nie — czyścimy bez sprawdzania (odczyt wywołałby pytanie o zgodę).
 * Przeglądarka pozwala pisać do schowka tylko aktywnej karcie, więc w tle czyszczenie się nie uda i nic nie robi.
 */
export const CLIPBOARD_CLEAR_MS = 60_000;

export interface ClipboardLike {
  writeText(text: string): Promise<void>;
  readText?(): Promise<string>;
}
export interface PermissionsLike {
  query(desc: { name: string }): Promise<{ state: string }>;
}

/** Wynik czyszczenia: `cleared` — schowek opróżniony; `kept` — zmienił się, zostawiony; `failed` — przeglądarka odmówiła. */
export type ClipboardClearResult = "cleared" | "kept" | "failed";

export async function clearClipboardIfStill(
  value: string,
  clipboard: ClipboardLike | undefined = typeof navigator === "undefined" ? undefined : navigator.clipboard,
  permissions: PermissionsLike | undefined = typeof navigator === "undefined" ? undefined : (navigator.permissions as PermissionsLike | undefined),
): Promise<ClipboardClearResult> {
  if (!clipboard) return "failed";
  try {
    if (clipboard.readText && permissions) {
      const granted = await permissions.query({ name: "clipboard-read" }).then((p) => p.state === "granted", () => false);
      if (granted && (await clipboard.readText()) !== value) return "kept";
    }
    await clipboard.writeText("");
    return "cleared";
  } catch {
    return "failed";
  }
}

/** Zleca czyszczenie za `ms`; zwraca funkcję anulującą (np. przy ponownym kopiowaniu). */
export function scheduleClipboardClear(value: string, ms = CLIPBOARD_CLEAR_MS, run: (v: string) => Promise<unknown> = clearClipboardIfStill): () => void {
  const t = setTimeout(() => { void run(value); }, ms);
  return () => clearTimeout(t);
}
