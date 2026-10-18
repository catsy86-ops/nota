/**
 * Ostatnie źródło wejścia: „touch” (palec/rysik), „mouse” albo „keyboard”.
 * Zapisane w `<html data-input>`: CSS chowa ramkę fokusu po dotyku (okno zamknięte
 * dotykiem oddaje fokus przyciskowi, a przeglądarka rysuje wtedy grubą ramkę),
 * a dymki Radix nie otwierają się z samego fokusu.
 */
export type InputModality = "touch" | "mouse" | "keyboard";

let current: InputModality = "mouse";

const NON_TEXT_INPUT = new Set(["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"]);

/** Pole, w którym Enter/Spacja to pisanie, nie obsługa przycisku. */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement || target.isContentEditable) return true;
  return target instanceof HTMLInputElement && !NON_TEXT_INPUT.has(target.type);
}

function set(next: InputModality) {
  if (next === current) return;
  current = next;
  document.documentElement.dataset.input = next;
}

if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", (e) => set(e.pointerType === "mouse" ? "mouse" : "touch"), true);
  document.addEventListener("keydown", (e) => {
    // Same modyfikatory i Escape nie przełączają — Esc zamyka okno po dotyku.
    if (e.key === "Tab" || e.key.startsWith("Arrow")) set("keyboard");
    // Enter i Spacja na przycisku (nie w polu tekstowym — tam klawiatura ekranowa wysyła to samo
    // i pole nie powinno dostać ramki po dotyku): po dotyku z klawiaturą zewnętrzną ramka wraca.
    else if ((e.key === "Enter" || e.key === " ") && !isTextEntry(e.target)) set("keyboard");
  }, true);
}

export function lastInputWasTouch(): boolean {
  return current === "touch";
}
