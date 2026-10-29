/**
 * Punkty w pomieszczeniach budowy (H2.1, plan 2026-10-29): pomieszczenie (Łazienka parter, Kuchnia)
 * z punktami wodnymi — typ, strony (zimna, ciepła, kanalizacja), wysokość i stan w trzech krokach:
 * podejście → próba → biały montaż (decyzja właściciela 2026-10-29). Czyste dane; zapis w Yjs
 * w `yPoints.ts`, akcje w `pointsStore.ts`.
 */

export type PointSide = "z" | "c" | "k";
export const POINT_SIDES: readonly PointSide[] = ["z", "c", "k"];
export const SIDE_LABEL: Readonly<Record<PointSide, string>> = { z: "zimna", c: "ciepła", k: "kanalizacja" };
export const SIDE_SHORT: Readonly<Record<PointSide, string>> = { z: "Z", c: "C", k: "K" };

/** Kroki punktu w kolejności; stan punktu to liczba zrobionych kroków od początku (0–3). */
export const POINT_STEPS = ["podejscie", "proba", "montaz"] as const;
export type PointStep = (typeof POINT_STEPS)[number];
export const STEP_LABEL: Readonly<Record<PointStep, string>> = { podejscie: "podejście", proba: "próba", montaz: "biały montaż" };

export interface PointType {
  id: string;
  label: string;
  sides: PointSide[];
  /** Wysokość podejścia wody [cm] ze standardu G-HEAT (`HEIGHTS` w `content.ts`); `null` = brak w materiale. */
  height: number | null;
}

/** Typy punktów. Wysokości tylko tam, gdzie podaje je tabela G-HEAT — reszta do wpisania na budowie. */
export const POINT_TYPES: readonly PointType[] = [
  { id: "umywalka", label: "Umywalka", sides: ["z", "c", "k"], height: 58 },
  { id: "wc-stelaz", label: "WC (stelaż)", sides: ["z", "k"], height: 130 },
  { id: "wc-kompakt", label: "WC kompakt", sides: ["z", "k"], height: null },
  { id: "prysznic", label: "Prysznic", sides: ["z", "c", "k"], height: 110 },
  { id: "wanna", label: "Wanna", sides: ["z", "c", "k"], height: 75 },
  { id: "odplyw-liniowy", label: "Odpływ liniowy", sides: ["k"], height: null },
  { id: "pralka", label: "Pralka", sides: ["z", "k"], height: 58 },
  { id: "zlew", label: "Zlew", sides: ["z", "c", "k"], height: 48 },
  { id: "zmywarka", label: "Zmywarka", sides: ["z", "k"], height: null },
  { id: "zawor-ogrodowy", label: "Zawór ogrodowy", sides: ["z"], height: null },
  { id: "kociol", label: "Kocioł", sides: ["z", "c"], height: null },
  { id: "inny", label: "Inny", sides: [], height: null },
];

export const pointType = (id: string): PointType => POINT_TYPES.find((t) => t.id === id) ?? POINT_TYPES[POINT_TYPES.length - 1];

/** Szablony pomieszczeń (decyzja właściciela 2026-10-29). */
export const ROOM_TEMPLATES: readonly { id: string; name: string; types: string[] }[] = [
  { id: "lazienka", name: "Łazienka", types: ["umywalka", "wc-stelaz", "prysznic", "pralka"] },
  { id: "kuchnia", name: "Kuchnia", types: ["zlew", "zmywarka"] },
];

export interface Room {
  id: string;
  name: string;
  order: number;
}

export interface WaterPoint {
  id: string;
  room: string;
  type: string;
  sides: PointSide[];
  /** Wysokość [cm]; brak = nie wpisana. */
  height?: number;
  /** Moment zrobienia kroku (ms) po nazwie kroku. */
  steps: Partial<Record<PointStep, number>>;
  order: number;
}

export const ROOM_NAME_MAX = 40;
export const ROOMS_MAX = 30;
export const POINTS_MAX = 200;
export const HEIGHT_MAX = 300;

const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

export function cleanRoom(raw: unknown): Room | null {
  const r = raw as Partial<Room> | null;
  if (!r || typeof r !== "object" || !isId(r.id)) return null;
  const name = typeof r.name === "string" ? r.name.trim().replace(/\s+/g, " ").slice(0, ROOM_NAME_MAX) : "";
  if (!name) return null;
  return { id: r.id, name, order: num(r.order) };
}

export function cleanPoint(raw: unknown): WaterPoint | null {
  const p = raw as Partial<WaterPoint> | null;
  if (!p || typeof p !== "object" || !isId(p.id) || !isId(p.room) || typeof p.type !== "string") return null;
  const type = pointType(p.type).id;
  const sides = Array.isArray(p.sides) ? POINT_SIDES.filter((s) => (p.sides as unknown[]).includes(s)) : [];
  const height = typeof p.height === "number" && Number.isFinite(p.height) && p.height > 0 ? Math.min(HEIGHT_MAX, Math.round(p.height)) : undefined;
  const steps: Partial<Record<PointStep, number>> = {};
  const rawSteps = p.steps && typeof p.steps === "object" ? (p.steps as Record<string, unknown>) : {};
  // Kroki tylko od początku, bez dziur: „próba” bez „podejścia” to śmieć z innej wersji — ucinamy.
  for (const s of POINT_STEPS) {
    const at = rawSteps[s];
    if (typeof at !== "number" || !Number.isFinite(at)) break;
    steps[s] = at;
  }
  return { id: p.id, room: p.room, type, sides, ...(height !== undefined ? { height } : {}), steps, order: num(p.order) };
}

/** Ile kroków punktu jest zrobionych (0–3). */
export const pointStage = (p: Pick<WaterPoint, "steps">): number => POINT_STEPS.filter((s) => p.steps[s] !== undefined).length;

/**
 * Stuknięcie kratki kroku `index`: kratka niezrobiona — zaznacza ją i wszystkie wcześniejsze (z datą
 * `now` dla nowych); zrobiona — cofa ją i wszystkie późniejsze. Kolejność kroków zostaje bez dziur.
 */
export function toggleStep(p: WaterPoint, index: number, now: number): WaterPoint {
  const stage = pointStage(p);
  const steps: Partial<Record<PointStep, number>> = {};
  const target = stage > index ? index : index + 1;
  POINT_STEPS.forEach((s, i) => { if (i < target) steps[s] = p.steps[s] ?? now; });
  return { ...p, steps };
}

/** Nowy punkt danego typu z domyślnymi stronami i wysokością z G-HEAT. */
export function newPoint(id: string, room: string, typeId: string, order: number): WaterPoint {
  const t = pointType(typeId);
  return { id, room, type: t.id, sides: [...t.sides], ...(t.height !== null ? { height: t.height } : {}), steps: {}, order };
}

export interface PointsProgress {
  /** Punkty po białym montażu. */
  done: number;
  total: number;
}

/** Postęp: gotowe punkty (wszystkie trzy kroki) z wszystkich. */
export function pointsProgress(points: readonly WaterPoint[]): PointsProgress {
  return { done: points.filter((p) => pointStage(p) === POINT_STEPS.length).length, total: points.length };
}

/** Punkty na danym kroku do zrobienia, np. „4 punkty do podejścia” na Dziś. */
export function pendingAt(points: readonly WaterPoint[], step: PointStep): number {
  const i = POINT_STEPS.indexOf(step);
  return points.filter((p) => pointStage(p) === i).length;
}

/** „Z C K” — krótki opis stron punktu. */
export const sidesLabel = (sides: readonly PointSide[]) => sides.map((s) => SIDE_SHORT[s]).join(" ");

/** Podpis zdjęcia punktu (H2.3): „Łazienka · Umywalka · 58 cm” — miejsce i wysokość, czyli „gdzie idzie rura”. */
export function pointCaption(roomName: string, p: Pick<WaterPoint, "type" | "height">): string {
  return [roomName, pointType(p.type).label, p.height !== undefined ? `${p.height} cm` : ""].filter(Boolean).join(" · ").slice(0, 80);
}

/** Najnowsze zdjęcie każdego punktu z wpisów dziennika (`JournalEntry.point`): id punktu → klucz zdjęcia. */
export function latestPointPhotos(journal: readonly { at: number; point?: string; images: readonly string[] }[]): Map<string, string> {
  const out = new Map<string, { at: number; ref: string }>();
  for (const e of journal) {
    if (!e.point || e.images.length === 0) continue;
    const prev = out.get(e.point);
    if (!prev || e.at >= prev.at) out.set(e.point, { at: e.at, ref: e.images[e.images.length - 1] });
  }
  return new Map([...out].map(([k, v]) => [k, v.ref]));
}

/** Co zostało na punktach (H2.2, karta „Przed wejściem”): „4 do podejścia · 2 do próby”; `null` = brak punktów albo wszystko gotowe. */
export function pointsTodo(points: readonly WaterPoint[]): string | null {
  const parts = [
    [pendingAt(points, "podejscie"), "do podejścia"],
    [pendingAt(points, "proba"), "do próby"],
    [pendingAt(points, "montaz"), "do montażu"],
  ].filter(([n]) => (n as number) > 0).map(([n, label]) => `${n} ${label}`);
  return parts.length ? parts.join(" · ") : null;
}
