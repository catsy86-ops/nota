/**
 * Wygląd notatki w stylu Notiona: ikona (emoji) i okładka. Okładka to jeden
 * z gotowych wzorów, a nie obraz — nie rusza więc synchronizacji plików ani
 * skarbca, a w dokumencie Yjs zajmuje kilka bajtów.
 */
export const NOTE_COVERS = ["dawn", "meadow", "sea", "dusk", "paper"] as const;
export type NoteCover = (typeof NOTE_COVERS)[number];

export const COVER_LABELS: Record<NoteCover, string> = {
  dawn: "Świt",
  meadow: "Łąka",
  sea: "Morze",
  dusk: "Zmierzch",
  paper: "Kratka",
};

/** Style okładek; „kratka” czerpie z motywu, więc pasuje do jasnego i ciemnego trybu. */
export const COVER_STYLES: Record<NoteCover, { background?: string; backgroundColor?: string; backgroundImage?: string; backgroundSize?: string }> = {
  dawn: { background: "linear-gradient(120deg, #f4c27a 0%, #e58f7b 100%)" },
  meadow: { background: "linear-gradient(120deg, #b7d7a8 0%, #6fae9a 100%)" },
  sea: { background: "linear-gradient(120deg, #9cc9e8 0%, #5b8fc7 100%)" },
  dusk: { background: "linear-gradient(120deg, #b9a6e6 0%, #7a7fc9 100%)" },
  paper: {
    backgroundColor: "var(--muted)",
    backgroundImage:
      "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
    backgroundSize: "12px 12px",
  },
};

export const NOTE_ICONS = [
  "📝", "📌", "⭐", "💡", "🎯", "🔥", "✅", "📅",
  "💼", "🏠", "🎓", "🎨", "🎵", "📷", "✈️", "🛒",
  "💰", "❤️", "🚀", "📚", "💻", "🧪", "🏋️", "🌱",
] as const;

export function isNoteCover(v: unknown): v is NoteCover {
  return typeof v === "string" && (NOTE_COVERS as readonly string[]).includes(v);
}
