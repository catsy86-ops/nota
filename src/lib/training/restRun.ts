/**
 * Trwająca przerwa między seriami (C2.6) — w pamięci, jak licznik w `RestTimer`. `PushScheduleSync` dokłada jej koniec
 * do harmonogramu tylko przy schowanej aplikacji (zgaszony ekran), żeby przy otwartej nie było dwóch sygnałów:
 * wibracji licznika i alarmu. Bez zapisu na dysk: zamknięta aplikacja i tak ma alarm postawiony przy chowaniu.
 */
export interface RestRun {
  startedAt: number;
  until: number;
}

let current: RestRun | null = null;
const listeners = new Set<() => void>();

export const restRun = {
  get: (): RestRun | null => current,
  set(next: RestRun | null) {
    if (next?.until === current?.until && next?.startedAt === current?.startedAt) return;
    current = next;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};
