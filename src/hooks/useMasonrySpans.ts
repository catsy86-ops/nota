import { useLayoutEffect, type RefObject } from "react";

/** Wysokość jednego wiersza siatki mozaiki (px) — karta zajmuje tyle wierszy, ile ma wysokości. */
export const MASONRY_ROW_PX = 4;

/**
 * Mozaika na siatce CSS: kontener ma wiersze po `MASONRY_ROW_PX`, a każda karta
 * dostaje `grid-row-end: span N` wg swojej wysokości (z dolnym marginesem jako
 * odstępem). Auto-placement układa wtedy karty od lewej do prawej, każdą w kolumnie,
 * która najwcześniej się kończy — kolejność w DOM = kolejność notatek, jeden rodzic.
 * Dlatego przeciąganie (dnd-kit), animacje układu i nawigacja strzałkami działają
 * jak w zwykłej siatce; kolumny CSS (`columns-*`) układały karty w dół kolumny.
 *
 * Jeden `ResizeObserver` na wszystkie karty, styl ustawiany wprost na elemencie —
 * zmiana wysokości karty nie przerysowuje Reacta. Nowe karty łapie `MutationObserver`.
 */
export function useMasonrySpans(container: RefObject<HTMLElement | null>, enabled: boolean, itemSelector: string): void {
  // Przed malowaniem: przy przełączeniu układu bez remontu siatki (`changeView`) karty
  // nie mrugają klatkę z rozpiętością z poprzedniego układu.
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const items = () => Array.from(root.querySelectorAll<HTMLElement>(itemSelector)).filter((el) => el.parentElement === root);
    if (!enabled) {
      items().forEach((el) => { el.style.gridRowEnd = ""; });
      return;
    }

    // Margines (odstęp gęstości) jest wspólny dla kart o tej samej klasie — `getComputedStyle`
    // na każdą kartę przy 300 kartach kosztował ~0,5 s (pomiar CPU 4×).
    const margins = new Map<string, number>();
    const marginOf = (el: HTMLElement) => {
      let m = margins.get(el.className);
      if (m === undefined) {
        m = parseFloat(getComputedStyle(el).marginBottom) || 0;
        margins.set(el.className, m);
      }
      return m;
    };
    const place = (el: HTMLElement, height?: number) => {
      const h = height ?? el.getBoundingClientRect().height;
      const span = Math.max(1, Math.ceil((h + marginOf(el)) / MASONRY_ROW_PX));
      const next = `span ${span}`;
      if (el.style.gridRowEnd !== next) el.style.gridRowEnd = next;
    };

    // Callback idzie po layoucie, a przed malowaniem — karty nie mrugają nałożone na siebie.
    // Wysokość z wpisu obserwatora (border-box) — bez ponownego pomiaru każdej karty.
    const resize = new ResizeObserver((entries) => entries.forEach((e) => place(e.target as HTMLElement, e.borderBoxSize?.[0]?.blockSize)));
    // Nowe karty (pierwsza paczka i dociągane): od razu, przed malowaniem — inaczej mignęłyby
    // z `span 1`. Najpierw wszystkie odczyty, potem zapisy: jeden przelicz układu na paczkę.
    const watchAll = (els: HTMLElement[]) => {
      const heights = els.map((el) => el.getBoundingClientRect().height);
      els.forEach((el, i) => { place(el, heights[i]); resize.observe(el); });
    };
    watchAll(items());

    const mutations = new MutationObserver((records) => {
      const added: HTMLElement[] = [];
      for (const r of records) r.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement && n.parentElement === root && n.matches(itemSelector)) added.push(n);
      });
      if (added.length) watchAll(added);
    });
    mutations.observe(root, { childList: true });

    return () => {
      resize.disconnect();
      mutations.disconnect();
    };
  }, [container, enabled, itemSelector]);
}
