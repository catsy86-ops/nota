import { flushSync } from "react-dom";
import { isMotionReduced } from "@/hooks/useMotionPref";

/**
 * Zmiana układu, kolumn albo gęstości bez skoku: kafel u góry ekranu zostaje
 * w tym samym miejscu, fokus wraca na tę samą notatkę, a stary i nowy układ
 * przenikają się (View Transitions; bez wsparcia albo przy ograniczonym ruchu —
 * od razu, ale nadal z zachowanym miejscem).
 *
 * Wcześniej siatka po zmianie układu rosła albo malała pod palcem: przy 300
 * notatkach przejście z listy na mozaikę zostawiało użytkownika kilka ekranów dalej.
 */

/** Kafel w siatce/liście/tablicy albo wiersz tabeli — wspólny znacznik notatki we wszystkich układach. */
const ITEM_SELECTOR = "[data-note-id-wrap], [data-note-row]";
/** Pod lepkim nagłówkiem — kafel schowany pod nim nie jest „u góry ekranu”. */
const TOP_INSET_PX = 72;
/** Przy samej górze strony nie kotwiczymy: zostajemy na górze. */
const AT_TOP_PX = 8;
/** Kafla może jeszcze nie być (render progresywny siatki: paczki w wolnych chwilach) — tyle czekamy. */
const MAX_WAIT_MS = 2000;
const USER_SCROLL_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

type DocWithVT = Document & { startViewTransition?: (cb: () => void) => unknown };

interface Anchor { id: string; top: number }

function noteIdOf(el: Element): string | null {
  return el.getAttribute("data-note-id-wrap") ?? el.getAttribute("data-note-row");
}

function findItem(id: string): HTMLElement | null {
  const esc = CSS.escape(id);
  return document.querySelector<HTMLElement>(`[data-note-id-wrap="${esc}"], [data-note-row="${esc}"]`);
}

/**
 * Najwyżej położona notatka, która zaczyna się pod nagłówkiem (w mozaice kolejność
 * w DOM ≠ kolejność na ekranie). Kafel ucięty u góry tylko wtedy, gdy innego nie ma
 * (jeden wysoki kafel na cały ekran).
 */
export function captureAnchor(): Anchor | null {
  if (window.scrollY < AT_TOP_PX) return null;
  let best: Anchor | null = null;
  let bestLeft = Infinity;
  let cut: Anchor | null = null;
  for (const el of document.querySelectorAll(ITEM_SELECTOR)) {
    const r = el.getBoundingClientRect();
    if (r.bottom <= TOP_INSET_PX || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth) continue;
    const id = noteIdOf(el);
    if (!id) continue;
    if (r.top < TOP_INSET_PX) { cut ??= { id, top: r.top }; continue; }
    if (!best || r.top < best.top - 1 || (Math.abs(r.top - best.top) <= 1 && r.left < bestLeft)) {
      best = { id, top: r.top };
      bestLeft = r.left;
    }
  }
  return best ?? cut;
}

/**
 * Przewija tak, by kotwica była tam, gdzie przed zmianą. `false` — kafla jeszcze nie ma
 * albo strona jest jeszcze za krótka, żeby go tam postawić (dochodzą kolejne paczki).
 */
export function restoreAnchor(anchor: Anchor): boolean {
  const el = findItem(anchor.id);
  if (!el) return false;
  const delta = el.getBoundingClientRect().top - anchor.top;
  if (Math.abs(delta) < 1) return true;
  window.scrollBy({ top: delta, behavior: "instant" as ScrollBehavior });
  return Math.abs(el.getBoundingClientRect().top - anchor.top) < 1;
}

let pendingAnchorId: string | null = null;

/**
 * Notatka, przy której ma zostać ekran, w trakcie zmiany widoku. Siatka montowana
 * od nowa (np. tabela → mozaika) renderuje od razu do niej, zamiast od pierwszej paczki.
 */
export function getPendingAnchorId(): string | null {
  return pendingAnchorId;
}

/** Notatka, w której był fokus — po zmianie układu jej element mógł zostać podmieniony (np. tabela → siatka). */
function focusedNoteId(): string | null {
  const active = document.activeElement;
  const item = active instanceof Element ? active.closest(ITEM_SELECTOR) : null;
  return item ? noteIdOf(item) : null;
}

function restoreFocus(id: string) {
  // Fokus nadal w dokumencie (ten sam kafel przeżył zmianę) — nie ruszamy.
  const active = document.activeElement;
  if (active && active !== document.body && active.isConnected) return;
  const el = findItem(id);
  if (!el) return;
  const target = el.matches("[tabindex]") ? el : el.querySelector<HTMLElement>("[tabindex], .cursor-pointer, button");
  target?.focus({ preventScroll: true });
}

export function changeView(apply: () => void): void {
  const anchor = captureAnchor();
  const focusId = focusedNoteId();

  const settle = () => {
    pendingAnchorId = anchor?.id ?? null;
    try { flushSync(apply); } finally { pendingAnchorId = null; }
    const placed = anchor ? restoreAnchor(anchor) : true;
    if (focusId) restoreFocus(focusId);
    if (!placed && anchor) {
      // Render progresywny: kafel dojdzie w kolejnej paczce — dociągamy miejsce, gdy się pojawi.
      // Gdy użytkownik w tym czasie sam przewinie albo stuknie, odpuszczamy.
      const start = performance.now();
      let raf = 0;
      const stop = () => {
        cancelAnimationFrame(raf);
        USER_SCROLL_EVENTS.forEach((t) => window.removeEventListener(t, stop, true));
      };
      const retry = () => {
        if (restoreAnchor(anchor)) { stop(); if (focusId) restoreFocus(focusId); return; }
        if (performance.now() - start < MAX_WAIT_MS) raf = requestAnimationFrame(retry);
        else stop();
      };
      USER_SCROLL_EVENTS.forEach((t) => window.addEventListener(t, stop, { capture: true, passive: true }));
      raf = requestAnimationFrame(retry);
    }
  };

  const doc = document as DocWithVT;
  if (typeof doc.startViewTransition === "function" && !isMotionReduced()) {
    doc.startViewTransition(settle);
    return;
  }
  settle();
}
