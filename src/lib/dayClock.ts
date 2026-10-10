import { useSyncExternalStore } from "react";

/**
 * Wspólny „zegar dnia”: sygnał do przeliczenia wszystkiego, co zależy od
 * bieżącej daty (widok Dziś, Kalendarz, Grafik, zaległe).
 *
 * Tyka w dwóch sytuacjach, w których zwykły `setInterval` zawodzi:
 * - karta wraca na pierwszy plan (`visibilitychange`, `focus`, `pageshow`) —
 *   przeglądarki wstrzymują timery w tle, a telefon bywa uśpiony godzinami;
 * - minęła północ (timer na najbliższą północ, po każdym wybudzeniu liczony
 *   od nowa).
 * Timer i nasłuchy działają tylko, gdy ktoś jest zasubskrybowany.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
let version = 0;
let midnightTimer: ReturnType<typeof setTimeout> | null = null;

/** Milisekundy do najbliższej północy (lokalnej), z zapasem 250 ms. */
export function msUntilMidnight(now: number = Date.now()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(1000, next.getTime() - now + 250);
}

function bump() {
  version++;
  listeners.forEach((l) => l());
}

function scheduleMidnight() {
  if (midnightTimer !== null) clearTimeout(midnightTimer);
  midnightTimer = setTimeout(() => {
    midnightTimer = null;
    bump();
    if (listeners.size > 0) scheduleMidnight();
  }, msUntilMidnight());
}

function onWake() {
  // Po uśpieniu timer mógł się spóźnić — liczymy go od nowa.
  scheduleMidnight();
  bump();
}

function onVisibility() {
  if (document.visibilityState === "visible") onWake();
}

function start() {
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", onWake);
  window.addEventListener("pageshow", onWake);
  scheduleMidnight();
}

function stop() {
  document.removeEventListener("visibilitychange", onVisibility);
  window.removeEventListener("focus", onWake);
  window.removeEventListener("pageshow", onWake);
  if (midnightTimer !== null) clearTimeout(midnightTimer);
  midnightTimer = null;
}

export function subscribeDayClock(listener: Listener): () => void {
  if (listeners.size === 0) start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

/** Numer „tyknięcia” — zmienia się po wznowieniu karty i po północy. */
export function useDayClock(): number {
  return useSyncExternalStore(subscribeDayClock, () => version, () => 0);
}

/** Test helper. */
export function _dayClockSubscriberCount(): number {
  return listeners.size;
}
