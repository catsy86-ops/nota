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

export const hasAISummarizer = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return (navigator as any).ai?.summarizer !== undefined;
};

/** Streszczanie tekstu za pomocą AI na urządzeniu. Zwraca `null` gdy niedostępne. */
export async function summarizeText(text: string, type: "key-points" | "teaser" | "tl;dr" = "tl;dr"): Promise<string | null> {
  try {
    if (!hasAISummarizer()) return null;
    const ai = (navigator as any).ai;
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
  return (navigator as any).ai?.writer !== undefined;
};

/** Dopisywanie/rozwijanie tekstu za pomocą AI. */
export async function expandText(text: string, tone: "formal" | "casual" = "casual"): Promise<string | null> {
  try {
    if (!hasAIWriter()) return null;
    const ai = (navigator as any).ai;
    if (!ai?.writer) return null;

    const writer = await ai.writer.create();
    const expanded = await writer.write(text, { tone, length: "medium" });
    return expanded || null;
  } catch {
    return null;
  }
}
