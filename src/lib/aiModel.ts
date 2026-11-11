/**
 * Streszczanie i odpowiadanie na pytania za pomocą Chrome Built-in AI Model.
 * Dostępny na Chrome Android 131+. Offline — brak wysyłania danych. (B3.6)
 */

interface AISummarizer {
  summarize(options: { text: string; type?: "key-points" | "teaser" | "tl;dr" }): Promise<string>;
}

interface AIWriter {
  write(text: string, options: { tone?: string; format?: string; length?: "short" | "medium" | "long" }): Promise<string>;
}

interface SelfAI {
  summarizer?: {
    create(): Promise<AISummarizer>;
  };
  writer?: {
    create(): Promise<AIWriter>;
  };
}

declare global {
  interface WorkerNavigator {
    ai?: SelfAI;
  }
  interface Navigator {
    ai?: SelfAI;
  }
}

/** Eksperymentalne API Chrome (`navigator.ai`) — brak w typach DOM, więc luźny kształt. */
const selfAi = (): { summarizer?: { create(): Promise<{ summarize(o: { text: string; type: string }): Promise<string> }> }; writer?: { create(): Promise<Record<string, (...a: never[]) => Promise<string>>> } } | undefined =>
  (navigator as unknown as { ai?: ReturnType<typeof selfAi> }).ai;

export const hasAISummarizer = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return selfAi()?.summarizer !== undefined;
};

/** Streszczanie tekstu za pomocą AI na urządzeniu. Zwraca `null` gdy niedostępne. */
export async function summarizeText(text: string, type: "key-points" | "teaser" | "tl;dr" = "tl;dr"): Promise<string | null> {
  try {
    if (!hasAISummarizer()) return null;
    const ai = selfAi();
    if (!ai?.summarizer) return null;

    const summarizer = await ai.summarizer.create();
    const summary = await summarizer.summarize({ text, type });
    return summary || null;
  } catch {
    return null;
  }
}

export const hasAIWriter = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return selfAi()?.writer !== undefined;
};

/** Dopisywanie/rozwijanie tekstu za pomocą AI. */
export async function expandText(text: string, tone: "formal" | "casual" = "casual"): Promise<string | null> {
  try {
    if (!hasAIWriter()) return null;
    const ai = selfAi();
    if (!ai?.writer) return null;

    const writer = await ai.writer.create();
    const expanded = await writer.write(text, { tone, length: "medium" });
    return expanded || null;
  } catch {
    return null;
  }
}
