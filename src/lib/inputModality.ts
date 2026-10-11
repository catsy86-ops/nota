/**
 * Ostatnie źródło wejścia: „touch” (palec/rysik), „mouse” albo „keyboard”.
 * Zapisane w `<html data-input>`: CSS chowa ramkę fokusu po dotyku (okno zamknięte
 * dotykiem oddaje fokus przyciskowi, a przeglądarka rysuje wtedy grubą ramkę),
 * a dymki Radix nie otwierają się z samego fokusu.
 */
export type InputModality = "touch" | "mouse" | "keyboard";

let current: InputModality = "mouse";

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
  }, true);
}

export function lastInputWasTouch(): boolean {
  return current === "touch";
}
