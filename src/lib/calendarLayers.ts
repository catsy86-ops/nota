/**
 * Warstwy kalendarza (K3.3): które rodzaje wpisów rysuje siatka i agenda. Wybór zapamiętany w tej przeglądarce;
 * błąd dostępu = wszystkie włączone. Liczniki miesiąca pokazują, ile jest każdego rodzaju.
 */
export type CalendarLayer = "terms" | "shifts" | "work" | "holidays";

export const CALENDAR_LAYERS: readonly CalendarLayer[] = ["terms", "shifts", "work", "holidays"];

export type CalendarLayerState = Record<CalendarLayer, boolean>;

export const ALL_LAYERS_ON: CalendarLayerState = { terms: true, shifts: true, work: true, holidays: true };

const KEY = "kaczy.calendar.layers";

export function readLayers(): CalendarLayerState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return ALL_LAYERS_ON;
    const parsed = JSON.parse(raw) as Partial<CalendarLayerState>;
    return {
      terms: parsed.terms !== false,
      shifts: parsed.shifts !== false,
      work: parsed.work !== false,
      holidays: parsed.holidays !== false,
    };
  } catch {
    return ALL_LAYERS_ON;
  }
}

export function writeLayers(state: CalendarLayerState): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* bez zapisu zostaje wybór na czas sesji */ }
}

/** Liczniki miesiąca: terminy (wystąpienia), dni ze zmianą, dni z Pracą i dni ze świętem. */
export function countMonth(keys: readonly string[], hasTerms: (k: string) => number, hasShift: (k: string) => boolean, hasWork: (k: string) => boolean, holiday: (k: string) => boolean): Record<CalendarLayer, number> {
  let terms = 0, shifts = 0, work = 0, holidays = 0;
  for (const k of keys) {
    terms += hasTerms(k);
    if (hasShift(k)) shifts++;
    if (hasWork(k)) work++;
    if (holiday(k)) holidays++;
  }
  return { terms, shifts, work, holidays };
}
