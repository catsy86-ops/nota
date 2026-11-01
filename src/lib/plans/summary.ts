import { measureRoute, metersPerPixel } from "./geometry";
import type { MaterialItem, PipeRoute, PlanCalibration, SymbolType, SystemType, DetectedSymbol } from "./model";
import { SYMBOL_META, SYSTEM_META } from "./systems";

/**
 * Zestawienie materiałów analizy (faza 7) — liczone przy odczycie z tras, symboli i ręcznych pozycji.
 * Rury grupowane po instalacji i średnicy, osobno według pewności pomiaru:
 *  - „potwierdzone” — trasa zatwierdzona, nie szacunkowa, plan ze skalą,
 *  - „szacunkowe” — zatwierdzona i oznaczona jako szacunkowa, ze skalą,
 *  - „bez skali” — zatwierdzona, ale plan bez kalibracji: tylko piksele, NIGDY metry,
 *  - „do weryfikacji” — trasy niezatwierdzone (np. z propozycji), poza pewnym zestawieniem.
 * Symbole: zatwierdzone w sztukach, niezatwierdzone osobno. Wiersze z tras są tylko do odczytu —
 * zmienia się je w trasie (D10); ręczne pozycje edytuje się w zestawieniu.
 */

export type PipeGroupStatus = "confirmed" | "estimated" | "noScale" | "unverified";

export const PIPE_STATUS_LABEL: Record<PipeGroupStatus, string> = {
  confirmed: "Rury — pomiar potwierdzony",
  estimated: "Rury — szacunkowo",
  noScale: "Rury — bez skali (tylko piksele)",
  unverified: "Rury do weryfikacji",
};

export interface PipeRow {
  key: string;
  status: PipeGroupStatus;
  system: SystemType;
  diameterMm?: number;
  /** Suma w metrach; `null` = bez skali. */
  meters: number | null;
  pixels: number;
  routeIds: string[];
}

export interface SymbolRow {
  key: string;
  type: SymbolType;
  system?: SystemType;
  count: number;
  verified: boolean;
  symbolIds: string[];
}

export interface PlanSummary {
  pipes: Record<PipeGroupStatus, PipeRow[]>;
  symbols: { verified: SymbolRow[]; unverified: SymbolRow[] };
  items: MaterialItem[];
  hasScale: boolean;
}

const SYSTEM_ORDER = Object.keys(SYSTEM_META) as SystemType[];

export function buildSummary(data: { routes: readonly PipeRoute[]; symbols: readonly DetectedSymbol[]; items: readonly MaterialItem[]; calibration: PlanCalibration | null }): PlanSummary {
  const mpp = metersPerPixel(data.calibration);
  const groups = new Map<string, PipeRow>();
  for (const r of data.routes) {
    const m = measureRoute(r, mpp);
    const status: PipeGroupStatus = !r.verified ? "unverified" : m.status;
    const key = `${status}|${r.system}|${r.diameterMm ?? ""}`;
    let g = groups.get(key);
    if (!g) { g = { key, status, system: r.system, ...(r.diameterMm !== undefined ? { diameterMm: r.diameterMm } : {}), meters: mpp === null ? null : 0, pixels: 0, routeIds: [] }; groups.set(key, g); }
    g.pixels += m.lengthPixels;
    if (g.meters !== null && m.lengthMeters !== null) g.meters += m.lengthMeters;
    g.routeIds.push(r.id);
  }
  const pipes: PlanSummary["pipes"] = { confirmed: [], estimated: [], noScale: [], unverified: [] };
  for (const g of groups.values()) pipes[g.status].push(g);
  const byOrder = (a: PipeRow, b: PipeRow) => SYSTEM_ORDER.indexOf(a.system) - SYSTEM_ORDER.indexOf(b.system) || (a.diameterMm ?? 1e9) - (b.diameterMm ?? 1e9);
  for (const k of Object.keys(pipes) as PipeGroupStatus[]) pipes[k].sort(byOrder);

  const sym = new Map<string, SymbolRow>();
  for (const s of data.symbols) {
    const key = `${s.verified}|${s.type}|${s.system ?? ""}`;
    let g = sym.get(key);
    if (!g) { g = { key, type: s.type, ...(s.system ? { system: s.system } : {}), count: 0, verified: s.verified, symbolIds: [] }; sym.set(key, g); }
    g.count++;
    g.symbolIds.push(s.id);
  }
  const symbolOrder = Object.keys(SYMBOL_META) as SymbolType[];
  const rows = [...sym.values()].sort((a, b) => symbolOrder.indexOf(a.type) - symbolOrder.indexOf(b.type) || SYSTEM_ORDER.indexOf(a.system ?? "unknown") - SYSTEM_ORDER.indexOf(b.system ?? "unknown"));
  return {
    pipes,
    symbols: { verified: rows.filter((r) => r.verified), unverified: rows.filter((r) => !r.verified) },
    items: [...data.items],
    hasScale: mpp !== null,
  };
}

/** „Rura ZW Ø16” — opis wiersza rur (CSV, braki w Pracy). */
export function pipeLabel(r: Pick<PipeRow, "system" | "diameterMm">): string {
  return `Rura ${SYSTEM_META[r.system].short}${r.diameterMm !== undefined ? ` Ø${String(r.diameterMm).replace(".", ",")}` : " (bez średnicy)"}`;
}

export function symbolLabel(r: Pick<SymbolRow, "type" | "system">): string {
  return `${SYMBOL_META[r.type].label}${r.system ? ` ${SYSTEM_META[r.system].short}` : ""}`;
}

/** Metry z dokładnością do 0,01 („12,35”). */
export const metersText = (m: number) => m.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Pozycje do przekazania jako braki budowy w Pracy: TYLKO rury z potwierdzonym pomiarem (ze skalą)
 * i zatwierdzone symbole oraz zatwierdzone ręczne pozycje. Szacunki, bez skali i do weryfikacji — nie.
 */
export function shortageItems(s: PlanSummary): { text: string; qty: string }[] {
  return [
    ...s.pipes.confirmed.filter((r) => r.meters !== null).map((r) => ({ text: pipeLabel(r), qty: `${metersText(r.meters!)} m` })),
    ...s.symbols.verified.map((r) => ({ text: symbolLabel(r), qty: `${r.count} szt.` })),
    ...s.items.filter((i) => i.verified).map((i) => ({ text: i.description, qty: `${i.quantity.toLocaleString("pl-PL")} ${i.unit === "szt" ? "szt." : "m"}` })),
  ];
}
