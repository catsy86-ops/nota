import type { Note } from "@/hooks/useNotes";

/**
 * Deterministyczny zestaw notatek do pomiarów wydajności (plan rozbudowy, Faza 0).
 * Ten sam `count` i `seed` zawsze dają ten sam zbiór, więc liczby między fazami są porównywalne.
 * Każda 5. notatka linkuje do poprzedniej (wikilinki), co 7. ma etykietę, co 11. jest przypięta.
 */
export function makeBigVault(count: number, seed = 1): Note[] {
  let s = seed >>> 0 || 1;
  const rnd = () => {
    // xorshift32: wystarczy do rozrzucenia słów, bez zależności.
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];

  const WORDS = [
    "budowa", "łazienka", "rura", "zawór", "faktura", "pomiar", "termin", "ciśnienie", "kafelki",
    "projekt", "spotkanie", "zakup", "przegląd", "notatka", "lista", "plan", "wzór", "szkic",
    "książka", "dzień", "tydzień", "ogród", "silnik", "kuchnia", "rachunek", "klient", "ślad",
  ];
  const LABELS = ["praca", "dom", "budowa", "nauka", "zdrowie", "finanse"];
  const BASE_TIME = Date.UTC(2026, 0, 1);

  const notes: Note[] = [];
  for (let i = 0; i < count; i++) {
    const title = `${pick(WORDS)} ${pick(WORDS)} ${i}`;
    const sentences: string[] = [];
    const sentenceCount = 3 + Math.floor(rnd() * 6);
    for (let k = 0; k < sentenceCount; k++) {
      const len = 5 + Math.floor(rnd() * 8);
      const words = Array.from({ length: len }, () => pick(WORDS));
      sentences.push(words.join(" ") + ".");
    }
    if (i > 0 && i % 5 === 0) sentences.push(`Zobacz [[${notes[i - 1].title}]].`);
    const updatedAt = BASE_TIME + i * 60_000;
    notes.push({
      id: `n${i}`,
      title,
      content: sentences.join(" "),
      color: "default",
      pinned: i % 11 === 0,
      archived: false,
      trashed: false,
      trashedAt: null,
      labels: i % 7 === 0 ? [pick(LABELS)] : [],
      reminder: null,
      priority: "none",
      images: [],
      checklist: [],
      folderId: null,
      order: i,
      createdAt: BASE_TIME,
      updatedAt,
    });
  }
  return notes;
}
