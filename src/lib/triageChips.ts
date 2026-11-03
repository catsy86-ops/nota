import { fold } from "@/lib/searchQuery";

/**
 * Chipy trybu porządkowania Skrzynki (plan Skrzynki 3.1): kolejność według użycia i filtr po wpisanym tekście.
 * Bez Reacta i bez magazynu — liczenie z listy notatek, żeby test nie potrzebował dokumentu.
 */
export type TriageChip =
  | { kind: "folder"; id: string; label: string }
  | { kind: "label"; label: string };

/** Ile chipów widać bez „Więcej” — tyle samo, ile skrótów 1–9. */
export const TRIAGE_TOP = 9;

interface NoteLike { folderId: string | null; labels: readonly string[] }

/**
 * Najczęściej używane najpierw (liczba notatek w folderze albo z etykietą). Przy remisie zostaje kolejność
 * wejściowa: foldery przed etykietami, jak dotąd.
 */
export function rankTriageChips(chips: readonly TriageChip[], notes: readonly NoteLike[]): TriageChip[] {
  const folderUse = new Map<string, number>();
  const labelUse = new Map<string, number>();
  for (const n of notes) {
    if (n.folderId) folderUse.set(n.folderId, (folderUse.get(n.folderId) ?? 0) + 1);
    for (const l of n.labels) labelUse.set(l, (labelUse.get(l) ?? 0) + 1);
  }
  const use = (c: TriageChip) => (c.kind === "folder" ? folderUse.get(c.id) : labelUse.get(c.label)) ?? 0;
  return chips
    .map((chip, i) => ({ chip, i, n: use(chip) }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.chip);
}

/** Wpisany tekst bez `#`/`@` na początku (jak frazy w polu Skrzynki) i bez zbędnych spacji. */
export function triageQuery(raw: string): string {
  return raw.trim().replace(/^[#@]+/, "").trim();
}

/** Chipy pasujące do zapytania (bez ogonków i wielkości liter); pierwsze te, które się od niego zaczynają. */
export function filterTriageChips(chips: readonly TriageChip[], raw: string): TriageChip[] {
  const q = fold(triageQuery(raw));
  if (!q) return [...chips];
  const starts: TriageChip[] = [];
  const contains: TriageChip[] = [];
  for (const c of chips) {
    const name = fold(c.label);
    if (name.startsWith(q)) starts.push(c);
    else if (name.includes(q)) contains.push(c);
  }
  return [...starts, ...contains];
}

/** Czy zapytanie to już istniejący folder albo etykieta (wtedy nie proponujemy „Nowy…” tego samego rodzaju). */
export function hasExact(chips: readonly TriageChip[], raw: string, kind: TriageChip["kind"]): boolean {
  const q = fold(triageQuery(raw));
  return chips.some((c) => c.kind === kind && fold(c.label) === q);
}
