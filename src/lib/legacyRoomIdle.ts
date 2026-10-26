/**
 * Zgodność ze starszą wersją (U-3, plan Ustawień 2.6): po 30 dniach bez urządzenia w starym pokoju
 * przełącznik wyłącza się sam. Zapisujemy start (włączenie) i ostatnie pojawienie się urządzenia.
 */
export const LEGACY_IDLE_MS = 30 * 24 * 60 * 60 * 1000;
const KEY = "kaczy.legacyRoomIdle.v1";

export interface LegacyIdleState {
  /** Chwila włączenia przełącznika (ms). */
  since: number;
  /** Ostatnie pojawienie się urządzenia w starym pokoju (ms), `null` = jeszcze nie. */
  seenAt: number | null;
}

export function readLegacyIdle(): LegacyIdleState | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<LegacyIdleState> | null;
    if (!raw || typeof raw.since !== "number") return null;
    return { since: raw.since, seenAt: typeof raw.seenAt === "number" ? raw.seenAt : null };
  } catch {
    return null;
  }
}

function writeLegacyIdle(state: LegacyIdleState | null): void {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {
    // Bez zapisu licznik startuje od nowa przy następnym włączeniu — gorzej nie będzie.
  }
}

export function markLegacyEnabled(now: number = Date.now()): void {
  writeLegacyIdle({ since: now, seenAt: null });
}

export function clearLegacyIdle(): void {
  writeLegacyIdle(null);
}

export function markLegacySeen(now: number = Date.now()): void {
  const cur = readLegacyIdle();
  if (cur) writeLegacyIdle({ ...cur, seenAt: now });
}

/** Czy minęło 30 dni od ostatniego pojawienia się (albo od włączenia, gdy jeszcze nikogo nie było). */
export function legacyIdleExpired(state: LegacyIdleState | null, now: number = Date.now()): boolean {
  if (!state) return false;
  return now - (state.seenAt ?? state.since) >= LEGACY_IDLE_MS;
}
