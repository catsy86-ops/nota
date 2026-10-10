/**
 * Chwilowy sygnał „ten termin właśnie przeniesiono”. Chip w nowym dniu jest
 * świeżym elementem (inna komórka), więc sam nie wie, że przyleciał — widok
 * zapisuje tu id notatki, a chip przy montażu gra mikro-odbicie. Nic nie jest
 * trwałe ani reaktywne: krótkie okno czasu wystarcza, a przełączenie miesiąca
 * po chwili nie odgrywa odbicia ponownie.
 */
const WINDOW_MS = 700;
let last: { noteId: string; at: number } | null = null;

export function markMoved(noteId: string): void {
  last = { noteId, at: Date.now() };
}

export function wasJustMoved(noteId: string): boolean {
  return !!last && last.noteId === noteId && Date.now() - last.at < WINDOW_MS;
}
