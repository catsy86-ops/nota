import { createPersistedStore } from "@/lib/persistedStore";
import { POWLOKA } from "@/lib/storage/names";

/**
 * Auto-aktualizacja (prośba właściciela 2026-11-26): nowa wersja aplikacji instaluje się sama, ale nigdy w trakcie
 * pracy. Podmiana = przeładowanie strony, więc warunki: nic nie czeka na zapis, a użytkownik wyszedł z aplikacji
 * (karta schowana) albo od minuty niczego nie dotyka ani nie pisze. Wyłączona — tylko dymek i przycisk w Ustawieniach.
 */

const store = createPersistedStore<boolean>(POWLOKA.autoUpdate, true, {
  merge: (def, stored) => (typeof stored === "boolean" ? stored : def),
});
export const useAutoUpdate = () => store.use();
export const getAutoUpdate = () => store.get();
export const setAutoUpdate = (on: boolean) => store.set(on);

/** Tyle bez dotyku, kliknięcia i klawisza, zanim podmienimy wersję przy otwartej karcie. */
export const AUTO_UPDATE_IDLE_MS = 60_000;
/** Przy włączonej auto-aktualizacji sprawdzamy częściej niż domyślne co godzinę. */
export const AUTO_UPDATE_CHECK_MS = 30 * 60_000;

export interface UpdateMoment {
  auto: boolean;
  waiting: boolean;
  unsaved: boolean;
  hidden: boolean;
  /** Ile ms od ostatniej aktywności użytkownika. */
  idleMs: number;
}

/** Czy teraz podmienić oczekującą wersję. Bez auto-aktualizacji — nigdy samo (zostaje dymek i przycisk). */
export function shouldAutoApply(m: UpdateMoment): boolean {
  if (!m.auto || !m.waiting || m.unsaved) return false;
  return m.hidden || m.idleMs >= AUTO_UPDATE_IDLE_MS;
}

let lastActivity = Date.now();
let tracking = false;

/** Zapamiętuje chwilę ostatniego dotyku, kliknięcia, klawisza lub przewinięcia (raz na stronę). */
export function trackActivity(): void {
  if (tracking || typeof window === "undefined") return;
  tracking = true;
  const bump = () => { lastActivity = Date.now(); };
  for (const ev of ["pointerdown", "keydown", "wheel", "touchstart", "input"] as const) window.addEventListener(ev, bump, { passive: true, capture: true });
}

export const idleFor = (now = Date.now()) => now - lastActivity;
