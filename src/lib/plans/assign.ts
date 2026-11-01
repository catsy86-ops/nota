import { distanceToPolyline } from "./geometry";
import { parseDiameter } from "./diameters";
import type { DetectedText, PipeRoute } from "./model";

/**
 * Podpowiedź średnicy dla trasy z odczytanych opisów: opis ze średnicą, którego środek leży najbliżej
 * trasy (w promieniu `maxDistance` pikseli oryginału). To tylko propozycja — średnica trafia do trasy
 * dopiero po „Przypisz” (zatwierdzenie użytkownika), nigdy sama.
 */
export interface DiameterSuggestion {
  textId: string;
  text: string;
  mm: number;
  /** Odległość opisu od trasy (piksele oryginału). */
  distance: number;
  confidence: number;
}

export function suggestDiameters(route: Pick<PipeRoute, "pts">, texts: readonly DetectedText[], maxDistance: number, limit = 3): DiameterSuggestion[] {
  const out: DiameterSuggestion[] = [];
  for (const t of texts) {
    const d = parseDiameter(t.text);
    if (!d) continue;
    const center = { x: t.box[0] + t.box[2] / 2, y: t.box[1] + t.box[3] / 2 };
    const distance = distanceToPolyline(center, route.pts);
    if (distance > maxDistance) continue;
    out.push({ textId: t.id, text: t.text, mm: d.mm, distance, confidence: Math.min(d.confidence, t.verified ? 1 : t.confidence) });
  }
  return out.sort((a, b) => a.distance - b.distance).slice(0, limit);
}
