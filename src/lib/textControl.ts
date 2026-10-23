import { caretCoordinates } from "@/lib/textareaCaret";

/**
 * Wspólny kształt pola tekstowego edytora notatki (plan rozbudowy, Faza 1a).
 * Pasuje do `HTMLTextAreaElement` (zwykłe pole) i do adaptera CodeMirror
 * (`components/editor/cmTextControl.ts`), dzięki czemu podpowiedzi, pasek
 * Znajdź/Zamień, licznik i przywracanie zaznaczenia nie znają silnika edytora.
 */
export interface TextControl {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  readonly offsetParent: Element | null;
  readonly offsetTop: number;
  readonly offsetLeft: number;
  scrollTop: number;
  setSelectionRange(start: number, end: number): void;
  setRangeText(text: string, start: number, end: number, mode?: "end"): void;
  focus(): void;
  /** Fokus na adapterze CM (textarea ma go w `activeElement`). */
  readonly focused?: boolean;
  /** Współrzędne karetki względem lewego górnego rogu pola. Brak = mierzy lustro (textarea). */
  caretCoords?(pos: number): { top: number; left: number; height: number };
}

/** Współrzędne karetki dla dowolnego `TextControl` (adapter liczy sam, textarea przez lustro). */
export function getCaretCoords(ta: TextControl, pos: number): { top: number; left: number; height: number } {
  if (ta.caretCoords) return ta.caretCoords(pos);
  return caretCoordinates(ta as HTMLTextAreaElement, pos);
}

/** Czy pole ma fokus: w textarea `activeElement`, w CM fokus na treści edytora. */
export function isTextControlFocused(ta: TextControl): boolean {
  if (ta instanceof HTMLTextAreaElement) return document.activeElement === ta;
  return ta.focused === true;
}
