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
/** Ile najbliższych zdarzeń popstate pochodzi z naszego własnego `history.back()`. */
let ignore = 0;
let listening = false;

function currentMark(): number | undefined {
  const s = window.history.state as Record<string, unknown> | null;
  const v = s?.[KEY];
  return typeof v === "number" ? v : undefined;
}

function onPopState() {
  if (ignore > 0) { ignore--; return; }
  const top = stack[stack.length - 1];
  if (top) {
    top.popped = true;
    top.close();
    return;
  }
  // Wpis po warstwie, której już nie ma — nic tu nie ma do pokazania, idziemy dalej wstecz.
  if (currentMark() !== undefined) window.history.back();
}

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
      ignore++;
      window.history.back();
    }
  };
}

/** Do testów. */
export function overlayDepth(): number {
  return stack.length;
}
