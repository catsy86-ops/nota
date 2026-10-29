import { fittingKey } from "./fittings";

/**
 * Rury zużyte na budowie w metrach (H1.1, plan 2026-10-29). Osobne pole wpisu, nie kształtki:
 * starsza wersja aplikacji robi na kształtkach `Math.floor` i odrzuca ilości poniżej 1, więc
 * „24,5 m” zapisałaby jako „24 szt.”. Nieznane pole `pipes` starsza wersja pomija i zostawia.
 * Długość w całych centymetrach — bez ułamków w danych (decyzja H-2).
 */
export interface Pipe {
  /** Nazwa z wymiarem, np. „Rura PEX 16×2”. */
  name: string;
  /** Długość w centymetrach (całkowita, ≥ 1). */
  cm: number;
}

export const PIPE_NAME_MAX = 40;
/** 1000 m na pozycję we wpisie — więcej to pomyłka w polu. */
export const PIPE_CM_MAX = 100_000;
export const PIPES_MAX = 10;

/** Podpowiedzi na start, zanim pojawią się własne nazwy z poprzednich wpisów. */
export const PIPE_SUGGESTIONS = [
  "Rura PEX 16×2", "Rura PEX 20×2", "Rura PEX 26×3", "Rura PEX 32×3", "Rura PP 20", "Rura PP 25", "Rura PVC 50", "Rura PVC 110",
];

/**
 * Dowolne wejście → lista rur: puste nazwy i długości ≤ 0 odpadają, długość w zakresie,
 * powtórzona nazwa (bez wielkości liter i ogonków) sumuje się do pierwszej pozycji.
 */
export function cleanPipes(raw: unknown): Pipe[] {
  if (!Array.isArray(raw)) return [];
  const out: Pipe[] = [];
  const at = new Map<string, number>();
  for (const r of raw) {
    const p = r as Partial<Pipe> | null;
    if (!p || typeof p !== "object" || typeof p.name !== "string" || typeof p.cm !== "number" || !Number.isFinite(p.cm)) continue;
    const name = p.name.trim().replace(/\s+/g, " ").slice(0, PIPE_NAME_MAX);
    const cm = Math.min(PIPE_CM_MAX, Math.round(p.cm));
    if (!name || cm < 1) continue;
    const k = fittingKey(name);
    const i = at.get(k);
    if (i !== undefined) { out[i] = { ...out[i], cm: Math.min(PIPE_CM_MAX, out[i].cm + cm) }; continue; }
    if (out.length >= PIPES_MAX) continue;
    at.set(k, out.length);
    out.push({ name, cm });
  }
  return out;
}

/** Suma rur z wielu wpisów, od najdłuższej; nazwa — pierwsza napotkana pisownia. */
export function sumPipes(lists: readonly (readonly Pipe[] | undefined)[]): Pipe[] {
  const by = new Map<string, Pipe>();
  for (const list of lists) {
    for (const p of list ?? []) {
      const k = fittingKey(p.name);
      const prev = by.get(k);
      by.set(k, prev ? { ...prev, cm: prev.cm + p.cm } : { ...p });
    }
  }
  return [...by.values()].sort((a, b) => b.cm - a.cm || a.name.localeCompare(b.name, "pl"));
}

/** „24,5 m” — przecinek dziesiętny, bez zbędnych zer, najwyżej dwa miejsca po przecinku. */
export function metersLabel(cm: number): string {
  const m = Math.round(cm) / 100;
  return `${m.toLocaleString("pl-PL", { maximumFractionDigits: 2, useGrouping: false })} m`;
}

/**
 * Tekst z pola („24,5”, „24.5”, „24,5 m”, „3m”, „24,”) → centymetry; `null` = nie da się odczytać
 * albo długość poza zakresem.
 */
export function parseMeters(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/\s*m$/, "").replace(",", ".");
  // Przecinek na końcu („24,”) to stan w trakcie pisania — liczy się jak całe metry, bez komunikatu.
  if (!/^\d+(\.\d*)?$/.test(t)) return null;
  const cm = Math.round(Number(t) * 100);
  return cm >= 1 && cm <= PIPE_CM_MAX ? cm : null;
}

/** „Rura PEX 16×2: 24,5 m, Rura PVC 110: 3 m” — do listy wpisów, raportu i wiadomości. */
export const pipesLine = (list: readonly Pipe[]) => list.map((p) => `${p.name}: ${metersLabel(p.cm)}`).join(", ");

/** Podpowiedzi nazw: najpierw używane we wpisach (od najdłuższych), potem domyślne; bez już wpisanych. */
export function suggestPipeNames(history: readonly (readonly Pipe[] | undefined)[], taken: readonly string[] = []): string[] {
  const skip = new Set(taken.map(fittingKey));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of [...sumPipes(history).map((p) => p.name), ...PIPE_SUGGESTIONS]) {
    const k = fittingKey(n);
    if (skip.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out;
}
