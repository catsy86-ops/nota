/**
 * Zgodność ze starszą wersją (U-3, plan Ustawień 2.6): po 30 dniach bez urządzenia w starym pokoju
 * przełącznik wyłącza się sam. Zapisujemy start (włączenie) i ostatnie pojawienie się urządzenia.
 * Twardy koniec po 90 dniach od włączenia (S2.6, `docs/plan-wymiana-kodu.md` §2.4) — także wtedy, gdy stare
 * urządzenie wciąż się pojawia; ponowne włączenie przełącznika startuje licznik od nowa.
 */
export const LEGACY_IDLE_MS = 30 * 24 * 60 * 60 * 1000;
export const LEGACY_MAX_MS = 90 * 24 * 60 * 60 * 1000;
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

/** Kiedy zgodność się wyłączy: 30 dni od ostatniego pojawienia się (albo włączenia), najpóźniej 90 dni od włączenia. */
export function legacyEndsAt(state: LegacyIdleState): number {
  return Math.min((state.seenAt ?? state.since) + LEGACY_IDLE_MS, state.since + LEGACY_MAX_MS);
}

export function legacyIdleExpired(state: LegacyIdleState | null, now: number = Date.now()): boolean {
  if (!state) return false;
  return now >= legacyEndsAt(state);
}
