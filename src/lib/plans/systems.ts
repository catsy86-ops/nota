import type { SymbolType, SystemType } from "./model";

/**
 * Rodzaje instalacji: nazwa, skrót z planów i kolor trasy na planie. Kolory dobrane tak, żeby odróżniały
 * się od siebie i od czarnych linii zrzutu z DWG (zimna — niebieska, ciepła — czerwona jak na armaturze).
 */
export const SYSTEM_META: Record<SystemType, { label: string; short: string; color: string }> = {
  cold: { label: "Zimna woda", short: "ZW", color: "#1e6fd9" },
  hot: { label: "Ciepła woda", short: "CWU", color: "#d6342b" },
  heating: { label: "Ogrzewanie", short: "CO", color: "#e07800" },
  sewage: { label: "Kanalizacja", short: "KAN", color: "#7a5230" },
  other: { label: "Inna", short: "INNA", color: "#7b4fc9" },
  unknown: { label: "Nierozpoznana", short: "?", color: "#6b7280" },
};

export const SYMBOL_META: Record<SymbolType, { label: string }> = {
  outlet: { label: "Punkt poboru" },
  valve: { label: "Zawór" },
  manifold: { label: "Rozdzielacz" },
  elbow: { label: "Kolano" },
  tee: { label: "Trójnik" },
  riser: { label: "Podejście / pion" },
  other: { label: "Inny" },
};

/** Typowe średnice na planach wod-kan i CO (mm) — podpowiedzi w polu średnicy. */
export const COMMON_DIAMETERS = [12, 14, 16, 18, 20, 22, 25, 26, 28, 32, 40, 50, 63, 75, 90, 110, 125, 160] as const;

/**
 * Przyciąganie kąta: punkt `p` po odcinku od `from` ustawiony na najbliższy kąt co 45° (0, 45, 90…),
 * z zachowaniem długości rzutu. Rury na planach biegną prawie zawsze poziomo, pionowo albo po skosie.
 */
export function snapAngle(from: { x: number; y: number }, p: { x: number; y: number }): { x: number; y: number } {
  const dx = p.x - from.x, dy = p.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return p;
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  const round = (v: number) => Math.round(v * 10) / 10;
  return { x: round(from.x + Math.cos(angle) * len), y: round(from.y + Math.sin(angle) * len) };
}
