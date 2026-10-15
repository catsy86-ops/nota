import { useLayoutEffect, type RefObject } from "react";

/**
 * Panel (czytnik, pełny edytor) rośnie z kafla, z którego go otwarto, i do niego
 * wraca: origin transformacji = środek kafla we współrzędnych panelu. Tylko
 * transform (bez `layoutId` — wspólny układ z kartą gryzłby się z dnd-kit
 * i kosztował pomiar przy każdym otwarciu). Kafel poza ekranem lub brak kafla
 * (paleta, inny widok) — zostaje środek panelu.
 *
 * `cssScale` — dla okien animowanych klasami `tw-animate-css` (`ui/dialog.tsx`):
 * nadpisuje w stylu skalę wejścia/wyjścia i zeruje przesunięcie, żeby okno
 * rosło z kafla zamiast wjeżdżać z góry. Czytnik animuje framer-motion — bez tego.
 *
 * `panel` może być samym elementem (z ref-callbacka): treść `Dialog` z Radix
 * montuje się w portalu render później, więc zwykły ref bywa pusty przy pomiarze.
 */
export function useOriginFromTile(
  panel: RefObject<HTMLElement | null> | HTMLElement | null,
  noteId: string,
  active = true,
  cssScale?: number,
) {
  const element = panel && "current" in panel ? null : panel;
  useLayoutEffect(() => {
    const el = panel && "current" in panel ? panel.current : panel;
    if (!active || !el) return;
    const tile = document.querySelector(`[data-note-id-wrap="${CSS.escape(noteId)}"]`);
    const t = tile?.getBoundingClientRect();
    if (!t || t.bottom < 0 || t.top > window.innerHeight) {
      el.style.transformOrigin = "";
      return;
    }
    if (cssScale !== undefined) {
      for (const phase of ["enter", "exit"]) {
        el.style.setProperty(`--tw-${phase}-scale`, String(cssScale));
        el.style.setProperty(`--tw-${phase}-translate-x`, "0");
        el.style.setProperty(`--tw-${phase}-translate-y`, "0");
      }
    }
    // Środek panelu nie zależy od skali wokół środka, więc pomiar w trakcie wejścia jest wierny.
    const p = el.getBoundingClientRect();
    const x = t.left + t.width / 2 - (p.left + p.width / 2) + el.offsetWidth / 2;
    const y = t.top + t.height / 2 - (p.top + p.height / 2) + el.offsetHeight / 2;
    el.style.transformOrigin = `${Math.round(x)}px ${Math.round(y)}px`;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `element` zamiast `panel`: ref to stały obiekt
  }, [element, noteId, active, cssScale]);
}
