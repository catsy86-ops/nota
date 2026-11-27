import { SIGNALS } from "@/lib/storage/names";
import { pluralPl } from "@/lib/plural";

/**
 * Q4.2 „Co się zmieniło, gdy mnie nie było”: po przerwie w zdalnych zmianach (pierwsza paczka w sesji albo
 * ≥ 10 min ciszy) zbiera notatki zmienione przez inne urządzenie i pokazuje ich listę.
 *
 * Wzorzec (`baseline`) to `updatedAt` notatek odświeżany po lokalnych zmianach — różnica po zdalnej paczce
 * to zmiany z zewnątrz. Lokalna edycja tuż przed paczką (przed odświeżeniem wzorca) może się wliczyć —
 * to przybliżenie, jak w dotychczasowym komunikacie „Zmiana z innego urządzenia”.
 */

export const AWAY_GAP_MS = 10 * 60_000;
/** Paczka po przerwie przychodzi kilkoma aktualizacjami — zbieramy je przez chwilę i pokazujemy raz. */
export const AWAY_COLLECT_MS = 4000;

export interface AwayNote { id: string; title: string; updatedAt: number }

interface NoteLike { id: string; title: string; updatedAt: number; locked?: boolean; trashed?: boolean }

/** Notatki nowsze niż we wzorcu albo nowe; bez prywatnych i kosza; najnowsze pierwsze. */
export function changedSince(baseline: ReadonlyMap<string, number>, notes: readonly NoteLike[]): AwayNote[] {
  return notes
    .filter((n) => !n.locked && !n.trashed && n.updatedAt > (baseline.get(n.id) ?? -Infinity))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
    .map((n) => ({ id: n.id, title: n.title.trim(), updatedAt: n.updatedAt }));
}

export const snapshotOf = (notes: readonly NoteLike[]): Map<string, number> => new Map(notes.map((n) => [n.id, n.updatedAt]));

/** „3 notatki zmienione na innym urządzeniu”. */
export function awayTitle(count: number): string {
  return `${count} ${pluralPl(count, ["notatka zmieniona", "notatki zmienione", "notatek zmienionych"])} na innym urządzeniu`;
}

let collectingNow = false;
/** Trwa zbieranie paczki „po przerwie” — przekaźnik nie pokazuje wtedy własnego „Zmiana z innego urządzenia”. */
export const awayBatchActive = () => collectingNow;

/** Lista dla okna (`AwayChangesHost`). */
export function showAwayChanges(notes: AwayNote[]): void {
  window.dispatchEvent(new CustomEvent<AwayNote[]>(SIGNALS.awayChanges, { detail: notes }));
}

/**
 * Stan zbierania: `onRemote` przy każdej zdalnej aktualizacji, `onLocal` przy lokalnej. Zwraca `true`, gdy paczka
 * należy do „powrotu” — wtedy zwykły komunikat o zmianie się nie pokazuje (byłyby dwa).
 */
export function createAwayTracker(deps: {
  notes: () => NoteLike[];
  now?: () => number;
  schedule?: (fn: () => void, ms: number) => void;
  report: (changed: AwayNote[]) => void;
}) {
  const now = deps.now ?? Date.now;
  const schedule = deps.schedule ?? ((fn, ms) => { setTimeout(fn, ms); });
  let baseline: Map<string, number> | null = null;
  let lastRemoteAt = 0;
  let collecting = false;
  let localTimer = false;

  const ensureBaseline = () => { baseline ??= snapshotOf(deps.notes()); };

  return {
    /** Wzorzec na starcie (po wczytaniu dokumentu), zanim przyjdą zmiany z sieci. */
    start(): void { ensureBaseline(); },
    onLocal(): void {
      if (collecting || localTimer) return;
      localTimer = true;
      // Odświeżenie wzorca po serii lokalnych zmian, nie przy każdym znaku.
      schedule(() => { localTimer = false; if (!collecting) baseline = snapshotOf(deps.notes()); }, 1000);
    },
    onRemote(): boolean {
      const t = now();
      const away = collecting || lastRemoteAt === 0 || t - lastRemoteAt >= AWAY_GAP_MS;
      lastRemoteAt = t;
      if (!away || collecting) return away;
      ensureBaseline();
      collecting = true;
      collectingNow = true;
      schedule(() => {
        collecting = false;
        collectingNow = false;
        const notes = deps.notes();
        const changed = changedSince(baseline!, notes);
        baseline = snapshotOf(notes);
        if (changed.length > 0) deps.report(changed);
      }, AWAY_COLLECT_MS);
      return true;
    },
  };
}
