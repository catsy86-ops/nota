// Sonda INP i CLS (plan UI/UX 2026-10-25, Faza 0.4). Tylko tryb dev: `main.tsx` ładuje ten moduł
// za `import.meta.env.DEV`, więc w paczce produkcyjnej go nie ma. Bez zależności — natywne
// `PerformanceObserver` (`event`, `layout-shift`). INP tu to najdłuższa interakcja z sesji
// (uproszczenie: prawdziwy INP to percentyl, ale do porównań przed/po wystarcza).

export type SlowInteraction = { name: string; duration: number; at: number };

export type PerfTally = {
  /** Najdłuższa interakcja od startu (ms); `0`, gdy jeszcze nie było. */
  worstInteraction: SlowInteraction | null;
  /** Skumulowane przesunięcie układu bez udziału użytkownika (CLS). */
  cls: number;
  recordEvent(entry: { name: string; duration: number; startTime: number }): SlowInteraction | null;
  recordLayoutShift(entry: { value: number; hadRecentInput: boolean }): number;
};

/** Stan sondy jako czysta funkcja: zwraca nowy rekord tylko wtedy, gdy pobija rekord. */
export function createPerfTally(): PerfTally {
  const tally: PerfTally = {
    worstInteraction: null,
    cls: 0,
    recordEvent(entry) {
      if (entry.duration <= 0) return null;
      if (tally.worstInteraction && entry.duration <= tally.worstInteraction.duration) return null;
      tally.worstInteraction = { name: entry.name, duration: entry.duration, at: entry.startTime };
      return tally.worstInteraction;
    },
    recordLayoutShift(entry) {
      // Przesunięcia po kliknięciu/wpisaniu są zamierzone i nie liczą się do CLS.
      if (!entry.hadRecentInput) tally.cls += entry.value;
      return tally.cls;
    },
  };
  return tally;
}

/** Podpina obserwatory i wypisuje w konsoli każdy nowy najgorszy wynik. Bez wsparcia — nic nie robi. */
export function installPerfProbe(): void {
  if (typeof PerformanceObserver === "undefined") return;
  const tally = createPerfTally();

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const worst = tally.recordEvent({ name: entry.name, duration: entry.duration, startTime: entry.startTime });
        if (worst) console.info(`[perf] INP ${Math.round(worst.duration)} ms — ${worst.name} (t=${Math.round(worst.at)} ms)`);
      }
    }).observe({ type: "event", buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
  } catch {
    // Przeglądarka bez `event` w PerformanceObserver — sonda po prostu nie działa.
  }

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
        const before = tally.cls;
        const cls = tally.recordLayoutShift(entry);
        if (cls !== before) console.info(`[perf] CLS ${cls.toFixed(3)}`);
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {
    // Brak `layout-shift` — bez CLS.
  }
}
