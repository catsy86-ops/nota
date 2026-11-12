/**
 * Tekst do porównań bez ogonków i wielkości liter („Łódź” → „lodz”). Osobny, bez zależności, bo używa go też Worker
 * wyszukiwania notatek (nie może ciągnąć za sobą reszty `searchQuery.ts`).
 */
export function fold(s: string): string {
  // Najpierw małe litery, potem „ł” — inaczej wielkie „Ł” zostawało bez zmiany i nie trafiało w „lodz”.
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ł/g, "l");
}
