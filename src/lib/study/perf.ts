/**
 * Pomiar wydajności Pracy na urządzeniu (plan B0.4). Bez sieci i bez treści: tylko czasy.
 * - Zdarzenia (`event`, bez pierwszego wejścia): czas reakcji na stuknięcie → p75 jak w INP.
 * - Długie klatki (`long-animation-frame`): ile było, jak długa najgorsza.
 * - Odcinki (`measureSpan`): np. otwarcie karty budowy do pierwszej klatki.
 * Wynik trafia do raportu diagnostycznego. Obserwatory włączają się raz, przy wejściu w Pracę.
 */

const MAX_SAMPLES = 200;
const events: number[] = [];
const frames: number[] = [];
const spans = new Map<string, number[]>();
let started = false;

function push(list: number[], v: number) {
  list.push(Math.round(v));
  if (list.length > MAX_SAMPLES) list.shift();
}

/** Percentyl metodą najbliższej pozycji; `null` dla pustej listy. */
export function percentile(values: readonly number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

function observe(type: string, onEntry: (e: PerformanceEntry) => void, extra: Record<string, unknown> = {}) {
  try {
    if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return;
    new PerformanceObserver((list) => list.getEntries().forEach(onEntry)).observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
  } catch {
    /* przeglądarka bez tego typu wpisów */
  }
}

/** Włącza obserwatory (raz). Bezpieczne tam, gdzie nie ma `PerformanceObserver` (testy, stare przeglądarki). */
export function startPerfProbe(): void {
  if (started || typeof PerformanceObserver === "undefined") return;
  started = true;
  observe("event", (e) => {
    // Tylko prawdziwe interakcje (stuknięcie, klawisz); `interactionId` ma każde z nich.
    if ((e as PerformanceEntry & { interactionId?: number }).interactionId) push(events, e.duration);
  }, { durationThreshold: 16 });
  observe("long-animation-frame", (e) => push(frames, e.duration));
}

/** Zaczyna odcinek; wywołanie zwróconej funkcji kończy go po najbliższej klatce. */
export function measureSpan(name: string): () => void {
  const t0 = performance.now();
  return () => {
    const end = () => {
      const list = spans.get(name) ?? [];
      push(list, performance.now() - t0);
      spans.set(name, list);
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => requestAnimationFrame(end));
    else end();
  };
}

export function perfReportLines(): string[] {
  const fmt = (v: number | null) => (v == null ? "brak" : `${v} ms`);
  const lines = [
    `reakcja na stuknięcie (${events.length} prób): p75 ${fmt(percentile(events, 75))}, najgorsza ${fmt(events.length ? Math.max(...events) : null)}`,
    `długie klatki (${frames.length}): najgorsza ${fmt(frames.length ? Math.max(...frames) : null)}`,
  ];
  for (const [name, list] of [...spans].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`${name} (${list.length}): mediana ${fmt(percentile(list, 50))}, p75 ${fmt(percentile(list, 75))}`);
  }
  return lines;
}

export function resetPerfForTests(): void {
  events.length = 0;
  frames.length = 0;
  spans.clear();
}
