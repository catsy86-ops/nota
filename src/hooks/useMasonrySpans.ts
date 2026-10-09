import { useEffect, type RefObject } from "react";

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
export function useMasonrySpans(container: RefObject<HTMLElement>, enabled: boolean, itemSelector: string): void {
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const items = () => Array.from(root.querySelectorAll<HTMLElement>(itemSelector)).filter((el) => el.parentElement === root);
    if (!enabled) {
      items().forEach((el) => { el.style.gridRowEnd = ""; });
      return;
    }

    const place = (el: HTMLElement) => {
      const margin = parseFloat(getComputedStyle(el).marginBottom) || 0;
      const span = Math.max(1, Math.ceil((el.getBoundingClientRect().height + margin) / MASONRY_ROW_PX));
      const next = `span ${span}`;
      if (el.style.gridRowEnd !== next) el.style.gridRowEnd = next;
    };

    // Callback idzie po layoucie, a przed malowaniem — karty nie mrugają nałożone na siebie.
    const resize = new ResizeObserver((entries) => entries.forEach((e) => place(e.target as HTMLElement)));
    const watch = (el: HTMLElement) => { place(el); resize.observe(el); };
    items().forEach(watch);

    const mutations = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement && n.parentElement === root && n.matches(itemSelector)) watch(n);
      });
    });
    mutations.observe(root, { childList: true });

    return () => {
      resize.disconnect();
      mutations.disconnect();
    };
  }, [container, enabled, itemSelector]);
}
