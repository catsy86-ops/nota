/**
 * Streszczenie tekstu modelem wbudowanym w przeglądarkę (Chrome: globalny `Summarizer`, wersja 138+, głównie
 * komputer). Działa na urządzeniu — tekst nie wychodzi do chmury. Eksperyment (B3.6): model może nie być
 * zainstalowany, a język polski nie jest oficjalnie wspierany, więc wynik zawsze trafia do edycji, nigdy automatycznie do wpisu.
 */

export type SummarizerAvailability = "unavailable" | "downloadable" | "downloading" | "available";
export type SummaryType = "tldr" | "key-points" | "teaser" | "headline";

interface SummarizerLike {
  summarize(text: string, options?: { context?: string }): Promise<string>;
  destroy?(): void;
}

interface SummarizerStatic {
  availability(options?: Record<string, unknown>): Promise<SummarizerAvailability>;
  create(options?: Record<string, unknown>): Promise<SummarizerLike>;
}

const api = (): SummarizerStatic | undefined => (globalThis as { Summarizer?: SummarizerStatic }).Summarizer;

/** Czy przeglądarka ma API streszczania (model może jeszcze wymagać pobrania — patrz `aiAvailability`). */
export const hasAISummarizer = (): boolean => typeof api()?.create === "function";

/** Stan modelu: `available` gotowy, `downloadable` do pobrania przy pierwszym użyciu, `unavailable` brak. */
export async function aiAvailability(): Promise<SummarizerAvailability> {
  try { return (await api()?.availability()) ?? "unavailable"; } catch { return "unavailable"; }
}

/** Najdłuższy tekst oddawany modelowi; dłuższy jest przycinany (okno kontekstu modelu jest małe). */
export const AI_INPUT_MAX = 4000;

/** Streszcza tekst na urządzeniu. `null` = brak API, model niedostępny, błąd albo pusty wynik. */
export async function summarizeText(text: string, type: SummaryType = "tldr"): Promise<string | null> {
  const clean = text.trim().slice(0, AI_INPUT_MAX);
  if (!clean) return null;
  let summarizer: SummarizerLike | undefined;
  try {
    const s = api();
    if (!s || (await aiAvailability()) === "unavailable") return null;
    summarizer = await s.create({ type, format: "plain-text", length: "short" });
    const out = (await summarizer.summarize(clean)).trim();
    return out || null;
  } catch {
    return null;
  } finally {
    try { summarizer?.destroy?.(); } catch { /* model już zwolniony */ }
  }
}
