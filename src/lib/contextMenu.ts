/**
 * Q5.3 Menu pod prawym przyciskiem (i przytrzymaniem na Androidzie, które wysyła to samo zdarzenie `contextmenu`):
 * otwiera **to samo** menu „⋯” co przycisk — ten sam komponent, te same pozycje, więc nic się nie rozjeżdża.
 * Wiersz woła `requestContextMenu(id)`, a menu słucha przez `useContextMenuTarget(id)` (`hooks/useContextMenu.ts`).
 */

type Listener = (id: string) => void;
const listeners = new Set<Listener>();

export function requestContextMenu(id: string): void {
  listeners.forEach((l) => l(id));
}

export function subscribeContextMenu(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Miejsca, gdzie zostaje zwykłe menu przeglądarki: pola tekstowe, edytor, linki. */
const NATIVE_TARGETS = "input, textarea, select, [contenteditable=''], [contenteditable='true'], .cm-editor, a[href]";

/**
 * Czy przejąć `contextmenu`: nie w polu tekstowym, edytorze ani na linku, nie przy zaznaczonym tekście
 * (kopiowanie) i nie z Shiftem (świadome zwykłe menu przeglądarki).
 */
export function shouldOpenContextMenu(e: { target: EventTarget | null; shiftKey: boolean }, selection: string): boolean {
  if (e.shiftKey || selection.trim()) return false;
  const el = e.target as Element | null;
  return !(el && typeof el.closest === "function" && el.closest(NATIVE_TARGETS));
}
