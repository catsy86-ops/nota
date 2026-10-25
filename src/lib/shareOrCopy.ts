/**
 * Udostępnianie tekstu z telefonu, a bez niego (albo po błędzie) kopia do schowka (§5.4).
 * Zwraca, co się stało, a komunikat i ewentualne przejście do grupy zostawia wywołującemu.
 */
export type ShareOutcome = "shared" | "cancelled" | "copied" | "failed";

export interface ShareInput {
  title?: string;
  text: string;
  files?: File[];
}

export async function shareOrCopy({ title, text, files }: ShareInput): Promise<ShareOutcome> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    const withFiles = !!files?.length && !!navigator.canShare?.({ files, text });
    try {
      await navigator.share(withFiles ? { title, text, files } : { title, text });
      return "shared";
    } catch (err) {
      // Anulowanie okna udostępniania to nie błąd; inny problem — kopia do schowka.
      if ((err as { name?: string } | null)?.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
