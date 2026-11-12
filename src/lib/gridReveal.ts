/**
 * Prośba „dorysuj kartę tej notatki” dla siatek, które montują karty dopiero przy przewijaniu (`NoteGrid`).
 * Wołają ją miejsca, które szukają karty w DOM: „pokaż tę notatkę” (`revealNote`), strzałki i Enter w nawigacji
 * klawiaturą. Siatka, która ma tę notatkę, rozszerza zamontowany zakres tak, żeby karta była w DOM w następnej klatce.
 */
const listeners = new Set<(id: string) => void>();

export function requestNoteRender(id: string): void {
  listeners.forEach((l) => l(id));
}

export function onNoteRenderRequest(cb: (id: string) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
