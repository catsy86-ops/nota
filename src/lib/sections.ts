// Odcień działu (D-4, plan UI/UX 2026-10-25, punkt 5.1). Kolor bierze się z palety motywu, nie z wpisanego hex:
// Notatki → --primary (bursztyn w Zeszycie), Grafik → --accent (niebieski długopis),
// Praca → --warning (najbliżej miedzi w palecie motywu), Kalendarz → --success (zieleń).
// Dzięki temu Matryca, Neon i pozostałe motywy dostają własne tony zamiast obcych barw.

export type SectionKey = "notes" | "shifts" | "study" | "calendar";

const SECTION_BY_VIEW: Partial<Record<string, SectionKey>> = {
  notes: "notes",
  shifts: "shifts",
  study: "study",
  calendar: "calendar",
};

/** Klasa koloru ikony działu dla widoku; `undefined` dla widoków bez własnego odcienia. */
export function sectionIconClass(view: string): string | undefined {
  const section = SECTION_BY_VIEW[view];
  return section ? `sec-${section}` : undefined;
}
