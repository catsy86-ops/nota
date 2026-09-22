/**
 * Global hourly ticker shared across all trash countdown badges.
 *
 * Instead of every NoteCard owning its own setInterval, components subscribe
 * to a single module-level timer that fires once per hour. The timer only runs
 * while there is at least one active subscriber, so it stops automatically
 * when no trashed notes are mounted/visible.
 */

const ONE_HOUR_MS = 60 * 60 * 1000;

type Listener = () => void;

const listeners = new Set<Listener>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function ensureRunning() {
  if (intervalId !== null || listeners.size === 0) return;
  intervalId = setInterval(() => {
    listeners.forEach((l) => l());
  }, ONE_HOUR_MS);
}

function stopIfIdle() {
  if (intervalId !== null && listeners.size === 0) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/** Subscribe to the global hourly tick. Returns an unsubscribe function. */
export function subscribeHourlyTick(listener: Listener): () => void {
  listeners.add(listener);
  ensureRunning();
  return () => {
    listeners.delete(listener);
    stopIfIdle();
  };
}

/** Test/debug helper — number of currently active subscribers. */
export function _getHourlyTickSubscriberCount(): number {
  return listeners.size;
}
