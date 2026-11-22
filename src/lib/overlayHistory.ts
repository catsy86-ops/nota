/**
 * Okna i arkusze w historii przeglądarki: przycisk „wstecz” (Android, gest iOS) zamyka
 * najwyższą otwartą warstwę, zamiast zmieniać widok pod nią albo wychodzić z aplikacji.
 *
 * Otwarcie warstwy dopisuje wpis do historii (ten sam adres, znacznik w `state`).
 * Zamknięcie z interfejsu zdejmuje ten wpis, o ile jest bieżący. Wpisy osierocone
 * (np. po nawigacji z arkusza) są przeskakiwane przy następnym „wstecz”.
 */
const KEY = "__overlay";

interface Entry {
  id: number;
  close: () => void;
  /** Wpis został już zużyty przez „wstecz” — przy zamknięciu nie cofamy drugi raz. */
  popped: boolean;
}

const stack: Entry[] = [];
let seq = 0;
/** Najbliższe zdarzenia popstate z naszego własnego `history.back()` — adres sprzed cofnięcia, dla każdego. */
const ignore: string[] = [];
let listening = false;

function currentMark(): number | undefined {
  const s = window.history.state as Record<string, unknown> | null;
  const v = s?.[KEY];
  return typeof v === "number" ? v : undefined;
}

/**
 * M2.2: zamknięcie warstwy z interfejsu cofa jej wpis, adres się nie zmienia, a router (BrowserRouter) i tak
 * ustawiał nową lokalizację i przerysowywał cały widok (~220 ms przy CPU ×4 na każde zamknięcie arkusza).
 *
 * Dwa słuchacze, bo na `window` Chromium wywołuje słuchaczy w kolejności rejestracji (faza przechwytywania nic
 * tu nie daje):
 * - `onOwnBack` — rejestrowany przy wczytaniu modułu, czyli przed routerem (App.tsx importuje moduł przed
 *   zamontowaniem BrowserRoutera). Rozpoznaje nasze własne cofnięcie i zatrzymuje je, gdy adres przed nim i po
 *   nim jest identyczny — router i tak jest już na tym adresie. Gdy adres się zmienił (router podmienił go na
 *   wpisie warstwy), zdarzenie idzie dalej do routera.
 * - `onPopState` — jak dawniej, po routerze (dopisywany przy pierwszej warstwie): „wstecz” systemowe zamyka
 *   najwyższą warstwę dopiero wtedy, gdy router przetworzył zdarzenie. Zamknięcie przed routerem psuło
 *   następne stuknięcie w kafel (pomiar M2.1, krok „otwarcie notatki”).
 */
const own = new WeakSet<Event>();

function onOwnBack(e: PopStateEvent) {
  const from = ignore.shift();
  if (from === undefined) return;
  own.add(e);
  if (window.location.href === from) e.stopImmediatePropagation();
}

function onPopState(e: PopStateEvent) {
  if (own.has(e)) return;
  const top = stack[stack.length - 1];
  if (top) {
    top.popped = true;
    top.close();
    return;
  }
  // Wpis po warstwie, której już nie ma — nic tu nie ma do pokazania, idziemy dalej wstecz.
  if (currentMark() !== undefined) window.history.back();
}

if (typeof window !== "undefined") window.addEventListener("popstate", onOwnBack);

export function registerOverlay(close: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  if (!listening) {
    window.addEventListener("popstate", onPopState);
    listening = true;
  }
  const entry: Entry = { id: ++seq, close, popped: false };
  stack.push(entry);
  try {
    window.history.pushState({ ...(window.history.state ?? {}), [KEY]: entry.id }, "");
  } catch { /* brak History API — okno działa bez „wstecz” */ }

  return () => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    if (!entry.popped && currentMark() === entry.id) {
      ignore.push(window.location.href);
      window.history.back();
    }
  };
}

/** Do testów. */
export function overlayDepth(): number {
  return stack.length;
}
