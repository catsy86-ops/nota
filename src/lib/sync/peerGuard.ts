/**
 * Strażnik wiadomości od urządzeń przez WebRTC (S2.5, Z-15.5, `docs/plan-wiadomosci-i-cofniecia.md` §1.4–§1.5).
 *
 * Czyta tylko długość i dwa pierwsze bajty wiadomości `y-webrtc` — niczego nie dekoduje. Wiadomości synchronizacji
 * nie wolno pominąć (pominięta aktualizacja Yjs zatrzymuje wszystkie późniejsze od tego klienta), więc dla nich wynik
 * to „przepuść” albo „zamknij połączenie”; pomijać wolno tylko awareness i pytanie o awareness.
 */

export type GuardVerdict = { kind: "pass" } | { kind: "drop" } | { kind: "close"; reason: string };

export interface GuardLimits {
  step1Max: number;
  step1PerMin: number;
  /** Krok 2 to pełna wymiana — rozmiar dokumentu, więc limit wysoki, ale rzadko. */
  step2Max: number;
  step2PerMin: number;
  updateMax: number;
  updatesPerMin: number;
  /** Bajty kroku 2 i aktualizacji na minutę (bez kroku 2 dla dokumentu obrazów: `Infinity`). */
  bytesPerMin: number;
  awarenessMax: number;
  awarenessPer10s: number;
  awarenessDropsPerMin: number;
  queryPerMin: number;
}

const KiB = 1024;
const MiB = 1024 * KiB;

/**
 * Dokument główny. Aktualizacja ≤ 4 MiB z kryterium 250 ms na telefonie: pomiar 2026-11-18 (Node na komputerze,
 * dokument z notatkami) — 1 MiB 14 ms, 4 MiB 38 ms, 8 MiB 94 ms, 16 MiB 147 ms; telefon średniej klasy ~4× wolniej.
 * Krok 2 ≤ 64 MiB: to cały dokument, mniejszy limit odciąłby duże zbiory notatek od synchronizacji bezpośredniej.
 */
export const DOC_LIMITS: GuardLimits = {
  step1Max: 64 * KiB, step1PerMin: 6,
  step2Max: 64 * MiB, step2PerMin: 6,
  updateMax: 4 * MiB, updatesPerMin: 600,
  bytesPerMin: 96 * MiB,
  awarenessMax: 4 * KiB, awarenessPer10s: 30, awarenessDropsPerMin: 3,
  queryPerMin: 6,
};

/** Dokument obrazów: pierwsza wymiana to cały zestaw, więc rozmiar ogranicza budżet pamięci w `imageSync`, nie strażnik. */
export const IMAGE_LIMITS: GuardLimits = {
  ...DOC_LIMITS,
  step2Max: 256 * MiB,
  updateMax: 256 * MiB,
  bytesPerMin: Infinity,
};

/** Liczniki jednego połączenia: znaczniki czasu (i bajty) w oknach przesuwnych. */
export interface GuardState {
  step1: number[];
  step2: number[];
  updates: number[];
  bytes: { t: number; n: number }[];
  awareness: number[];
  drops: number[];
  query: number[];
}

export const newGuardState = (): GuardState => ({ step1: [], step2: [], updates: [], bytes: [], awareness: [], drops: [], query: [] });

const prune = (a: number[], from: number) => { while (a.length > 0 && a[0] <= from) a.shift(); };

/** Klasyfikuje wiadomość i dopisuje ją do liczników. Czysta poza zmianą `s`. */
export function classify(b: Uint8Array, s: GuardState, l: GuardLimits, now: number): GuardVerdict {
  const min = now - 60_000;
  const len = b.length;
  if (len === 0) return { kind: "close", reason: "pusta wiadomość" };
  const type = b[0];
  if (type === 0) {
    const sub = len > 1 ? b[1] : -1;
    if (sub === 0) {
      if (len > l.step1Max) return { kind: "close", reason: `krok 1: ${len} B` };
      prune(s.step1, min);
      if (s.step1.length >= l.step1PerMin) return { kind: "close", reason: "krok 1: za często" };
      s.step1.push(now);
      return { kind: "pass" };
    }
    if (sub !== 1 && sub !== 2) return { kind: "close", reason: `synchronizacja: podtyp ${sub}` };
    const step2 = sub === 1;
    if (len > (step2 ? l.step2Max : l.updateMax)) return { kind: "close", reason: `${step2 ? "krok 2" : "aktualizacja"}: ${len} B` };
    const times = step2 ? s.step2 : s.updates;
    prune(times, min);
    if (times.length >= (step2 ? l.step2PerMin : l.updatesPerMin)) return { kind: "close", reason: `${step2 ? "krok 2" : "aktualizacje"}: za często` };
    while (s.bytes.length > 0 && s.bytes[0].t <= min) s.bytes.shift();
    const total = s.bytes.reduce((a, x) => a + x.n, 0) + len;
    if (total > l.bytesPerMin) return { kind: "close", reason: `${Math.round(total / MiB)} MiB na minutę` };
    times.push(now);
    s.bytes.push({ t: now, n: len });
    return { kind: "pass" };
  }
  if (type === 1) {
    prune(s.awareness, now - 10_000);
    const over = len > l.awarenessMax || s.awareness.length >= l.awarenessPer10s;
    if (!over) { s.awareness.push(now); return { kind: "pass" }; }
    prune(s.drops, min);
    s.drops.push(now);
    if (s.drops.length >= l.awarenessDropsPerMin) return { kind: "close", reason: "awareness: za dużo pominięć" };
    return { kind: "drop" };
  }
  if (type === 3) {
    if (len > 2) return { kind: "drop" };
    prune(s.query, min);
    if (s.query.length >= l.queryPerMin) return { kind: "drop" };
    s.query.push(now);
    return { kind: "pass" };
  }
  return { kind: "close", reason: `typ ${type}` };
}

// ── zamknięcia w grupie i wstrzymanie ───────────────────────────────────────

const CLOSE_WINDOW_MS = 10 * 60_000;
const CLOSES_TO_PAUSE = 3;
export const PAUSE_MS = 15 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/**
 * Licznik zamknięć na całą grupę (identyfikator połączenia jest losowy przy każdym połączeniu). Trzy zamknięcia
 * w 10 minut → wstrzymanie synchronizacji bezpośredniej na 15 minut. Stan tylko w pamięci karty.
 */
export class PeerCloseCounter {
  private closes: number[] = [];
  private pauses: number[] = [];
  pausedUntil = 0;

  /** Zapisuje zamknięcie; `true`, gdy właśnie trzeba wstrzymać. */
  record(now: number): boolean {
    this.closes = this.closes.filter((t) => t > now - CLOSE_WINDOW_MS);
    this.closes.push(now);
    if (this.closes.length < CLOSES_TO_PAUSE || now < this.pausedUntil) return false;
    this.closes = [];
    this.pauses = this.pauses.filter((t) => t > now - DAY_MS);
    this.pauses.push(now);
    this.pausedUntil = now + PAUSE_MS;
    return true;
  }

  paused(now: number): boolean {
    return now < this.pausedUntil;
  }

  /** Ile wstrzymań w ostatniej dobie (drugie dokłada radę o wymianie kodu). */
  pausesToday(now: number): number {
    return this.pauses.filter((t) => t > now - DAY_MS).length;
  }

  resume(): void {
    this.pausedUntil = 0;
    this.closes = [];
  }
}

export const MAX_AWARENESS_STATES = 64;
