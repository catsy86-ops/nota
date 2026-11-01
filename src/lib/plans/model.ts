import { isImageRef } from "@/lib/imageStore";

/**
 * Analizator planów hydraulicznych — model danych. Wszystkie współrzędne są w pikselach ORYGINAŁU
 * obrazu (zoom, przesunięcie i kopia robocza ich nie zmieniają). Wartości pochodne (długości, metry,
 * status pomiaru, zestawienie) liczy się przy odczycie, więc ponowna kalibracja ich nie rozjeżdża.
 * Dane od innego urządzenia są niezaufane: każdy odczyt przechodzi przez `clean*`.
 */

export const PLAN_PROJECTS_MAX = 50;
export const PLAN_ROUTES_MAX = 500;
export const PLAN_ROUTE_POINTS_MAX = 1000;
export const PLAN_TEXTS_MAX = 1000;
export const PLAN_SYMBOLS_MAX = 1000;
export const PLAN_ITEMS_MAX = 200;
export const PLAN_NAME_MAX = 80;
export const PLAN_LABEL_MAX = 120;
/** Największy bok obrazu, jaki przyjmujemy (px); plany z DWG FastView to zrzuty ekranu. */
export const PLAN_IMAGE_SIDE_MAX = 12_000;
/** Największa liczba pikseli (40 MP) — dekodowanie większych grozi brakiem pamięci na telefonie. */
export const PLAN_IMAGE_PIXELS_MAX = 40_000_000;
export const PLAN_FILE_BYTES_MAX = 20 * 1024 * 1024;

export type PlanStatus = "draft" | "active" | "done";
export const PLAN_STATUSES: readonly PlanStatus[] = ["draft", "active", "done"];

export type PlanImageType = "image/png" | "image/jpeg" | "image/webp";
export const PLAN_IMAGE_TYPES: readonly PlanImageType[] = ["image/png", "image/jpeg", "image/webp"];

/** Obraz w `imageStore`: klucz, typ, rozmiar i wymiary w pikselach. */
export interface PlanImage {
  ref: string;
  type: PlanImageType;
  size: number;
  w: number;
  h: number;
}

export interface AnalysisProject {
  id: string;
  name: string;
  /** Budowa z działu Praca (`SiteCard.id`), jeśli analiza do niej należy. */
  siteId?: string;
  /** Oryginał — pomiary i współrzędne zawsze w jego układzie. */
  image: PlanImage;
  /** Kopia robocza (mniejsza) do wyświetlania i synchronizacji, gdy oryginał jest duży. */
  work?: PlanImage;
  status: PlanStatus;
  createdAt: number;
  updatedAt: number;
}

export interface PlanPoint { x: number; y: number }

/** Kalibracja: dwa punkty na obrazie i ich znana odległość w metrach. */
export interface PlanCalibration {
  a: PlanPoint;
  b: PlanPoint;
  meters: number;
  at: number;
}

export type SystemType = "cold" | "hot" | "heating" | "sewage" | "other" | "unknown";
export const SYSTEM_TYPES: readonly SystemType[] = ["cold", "hot", "heating", "sewage", "other", "unknown"];

export interface PipeRoute {
  id: string;
  system: SystemType;
  diameterMm?: number;
  /** Płaska lista współrzędnych `[x0, y0, x1, y1, …]` w pikselach oryginału. */
  pts: number[];
  source: "manual" | "auto";
  /** Pewność propozycji automatycznej (0–1); trasa ręczna jej nie ma. */
  confidence?: number;
  verified: boolean;
  /** Długość szacunkowa (np. trasa poprowadzona „na oko”) — w zestawieniu osobno od potwierdzonych. */
  estimate?: boolean;
  label?: string;
  at: number;
}

export interface DetectedText {
  id: string;
  /** Tekst odczytany przez OCR, bez zmian. */
  raw: string;
  /** Tekst po normalizacji albo poprawce użytkownika. */
  text: string;
  /** Prostokąt `[x, y, w, h]` w pikselach oryginału. */
  box: [number, number, number, number];
  confidence: number;
  verified: boolean;
  at: number;
}

export type SymbolType = "outlet" | "valve" | "manifold" | "elbow" | "tee" | "riser" | "other";
export const SYMBOL_TYPES: readonly SymbolType[] = ["outlet", "valve", "manifold", "elbow", "tee", "riser", "other"];

export interface DetectedSymbol {
  id: string;
  type: SymbolType;
  x: number;
  y: number;
  system?: SystemType;
  confidence?: number;
  /** Dodany ręcznie (nie z rozpoznawania). */
  manual: boolean;
  verified: boolean;
  at: number;
}

export type MaterialUnit = "m" | "szt";

/** Ręczna pozycja zestawienia (wiersze z tras i symboli liczone są przy odczycie). */
export interface MaterialItem {
  id: string;
  category: string;
  description: string;
  system?: SystemType;
  diameterMm?: number;
  quantity: number;
  unit: MaterialUnit;
  verified: boolean;
  at: number;
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64 && /^[\w-]+$/.test(v);
const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
const unit01 = (v: unknown) => (num(v) ? Math.min(1, Math.max(0, v)) : undefined);
/** Współrzędna z dokładnością 0,1 px, w granicach obrazu z zapasem (punkt tuż za krawędzią jest w porządku). */
const coord = (v: unknown) => (num(v) && Math.abs(v) <= PLAN_IMAGE_SIDE_MAX * 2 ? Math.round(v * 10) / 10 : null);
/** Średnica rury w mm: typowe 10–1000. */
export const cleanDiameter = (v: unknown) => (num(v) && v >= 6 && v <= 1000 ? Math.round(v * 10) / 10 : undefined);

export const isPlanId = isId;

export function cleanPlanImage(raw: unknown): PlanImage | undefined {
  const i = raw as Partial<PlanImage> | null;
  if (!i || typeof i !== "object" || typeof i.ref !== "string" || !isImageRef(i.ref)) return undefined;
  if (!PLAN_IMAGE_TYPES.includes(i.type as PlanImageType)) return undefined;
  if (!num(i.w) || !num(i.h) || i.w < 1 || i.h < 1 || i.w > PLAN_IMAGE_SIDE_MAX || i.h > PLAN_IMAGE_SIDE_MAX || i.w * i.h > PLAN_IMAGE_PIXELS_MAX) return undefined;
  return { ref: i.ref, type: i.type as PlanImageType, size: num(i.size) && i.size >= 0 ? Math.round(i.size) : 0, w: Math.round(i.w), h: Math.round(i.h) };
}

export function cleanProject(raw: unknown): AnalysisProject | null {
  const p = raw as Partial<AnalysisProject> | null;
  if (!p || typeof p !== "object" || !isId(p.id)) return null;
  const image = cleanPlanImage(p.image);
  if (!image) return null;
  const work = cleanPlanImage(p.work);
  const createdAt = num(p.createdAt) && p.createdAt > 0 ? p.createdAt : 0;
  return {
    id: p.id,
    name: str(p.name, PLAN_NAME_MAX) || "Plan bez nazwy",
    ...(isId(p.siteId) ? { siteId: p.siteId } : {}),
    image,
    ...(work ? { work } : {}),
    status: oneOf(PLAN_STATUSES, p.status, "draft"),
    createdAt,
    updatedAt: num(p.updatedAt) && p.updatedAt >= createdAt ? p.updatedAt : createdAt,
  };
}

export function cleanPoint(raw: unknown): PlanPoint | null {
  const p = raw as Partial<PlanPoint> | null;
  const x = coord(p?.x), y = coord(p?.y);
  return x === null || y === null ? null : { x, y };
}

export function cleanCalibration(raw: unknown): PlanCalibration | null {
  const c = raw as Partial<PlanCalibration> | null;
  if (!c || typeof c !== "object") return null;
  const a = cleanPoint(c.a), b = cleanPoint(c.b);
  if (!a || !b || !num(c.meters) || c.meters <= 0 || c.meters > 10_000) return null;
  return { a, b, meters: c.meters, at: num(c.at) ? c.at : 0 };
}

export function cleanRoute(raw: unknown): PipeRoute | null {
  const r = raw as Partial<PipeRoute> | null;
  if (!r || typeof r !== "object" || !isId(r.id) || !Array.isArray(r.pts)) return null;
  const pts: number[] = [];
  for (let i = 0; i + 1 < r.pts.length && pts.length < PLAN_ROUTE_POINTS_MAX * 2; i += 2) {
    const x = coord(r.pts[i]), y = coord(r.pts[i + 1]);
    if (x === null || y === null) return null;
    pts.push(x, y);
  }
  if (pts.length < 4) return null;
  const diameterMm = cleanDiameter(r.diameterMm);
  const confidence = unit01(r.confidence);
  const label = str(r.label, PLAN_LABEL_MAX);
  return {
    id: r.id,
    system: oneOf(SYSTEM_TYPES, r.system, "unknown"),
    ...(diameterMm !== undefined ? { diameterMm } : {}),
    pts,
    source: r.source === "auto" ? "auto" : "manual",
    ...(confidence !== undefined ? { confidence } : {}),
    verified: r.verified === true,
    ...(r.estimate === true ? { estimate: true } : {}),
    ...(label ? { label } : {}),
    at: num(r.at) ? r.at : 0,
  };
}

export function cleanText(raw: unknown): DetectedText | null {
  const t = raw as Partial<DetectedText> | null;
  if (!t || typeof t !== "object" || !isId(t.id) || !Array.isArray(t.box) || t.box.length !== 4) return null;
  const box = t.box.map(coord);
  if (box.some((v) => v === null) || (box[2] as number) <= 0 || (box[3] as number) <= 0) return null;
  const text = str(t.text, PLAN_LABEL_MAX);
  if (!text) return null;
  return {
    id: t.id,
    raw: str(t.raw, PLAN_LABEL_MAX),
    text,
    box: box as [number, number, number, number],
    confidence: unit01(t.confidence) ?? 0,
    verified: t.verified === true,
    at: num(t.at) ? t.at : 0,
  };
}

export function cleanSymbol(raw: unknown): DetectedSymbol | null {
  const s = raw as Partial<DetectedSymbol> | null;
  if (!s || typeof s !== "object" || !isId(s.id)) return null;
  const x = coord(s.x), y = coord(s.y);
  if (x === null || y === null) return null;
  const confidence = unit01(s.confidence);
  return {
    id: s.id,
    type: oneOf(SYMBOL_TYPES, s.type, "other"),
    x, y,
    ...(SYSTEM_TYPES.includes(s.system as SystemType) ? { system: s.system as SystemType } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    manual: s.manual === true,
    verified: s.verified === true,
    at: num(s.at) ? s.at : 0,
  };
}

export function cleanItem(raw: unknown): MaterialItem | null {
  const i = raw as Partial<MaterialItem> | null;
  if (!i || typeof i !== "object" || !isId(i.id)) return null;
  const description = str(i.description, PLAN_LABEL_MAX);
  if (!description || !num(i.quantity) || i.quantity < 0 || i.quantity > 100_000) return null;
  const diameterMm = cleanDiameter(i.diameterMm);
  return {
    id: i.id,
    category: str(i.category, 40) || "inne",
    description,
    ...(SYSTEM_TYPES.includes(i.system as SystemType) ? { system: i.system as SystemType } : {}),
    ...(diameterMm !== undefined ? { diameterMm } : {}),
    quantity: Math.round(i.quantity * 100) / 100,
    unit: i.unit === "szt" ? "szt" : "m",
    verified: i.verified === true,
    at: num(i.at) ? i.at : 0,
  };
}

/** Kolor warstwy na planie → rodzaj instalacji (per analiza; pipeta w propozycjach tras). */
export interface PlanColor {
  hex: string;
  system: SystemType;
}

export const PLAN_COLORS_MAX = 12;

export function cleanColors(raw: unknown): PlanColor[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: PlanColor[] = [];
  for (const c of raw as Partial<PlanColor>[]) {
    const hex = typeof c?.hex === "string" && /^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex.toLowerCase() : null;
    if (!hex || seen.has(hex) || !SYSTEM_TYPES.includes(c.system as SystemType)) continue;
    seen.add(hex);
    out.push({ hex, system: c.system as SystemType });
    if (out.length >= PLAN_COLORS_MAX) break;
  }
  return out;
}
