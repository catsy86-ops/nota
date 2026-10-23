/**
 * Paralaksa tła stylu Zorza (plan rozbudowy, Faza 1b): przewijanie ustawia `--sig-scroll` na `<html>`,
 * a CSS przesuwa wstęgi przez `translate` (osobna właściwość, więc nie psuje animacji `transform`).
 * Słucha przewijania w fazie przechwytywania, bo główny kontener to nie `window`. Jedna pętla na klatkę.
 */
export const PARALLAX_VAR = "--sig-scroll";

export function scrollOffset(target: EventTarget | null): number {
  if (!target || target === document || target === window) return window.scrollY;
  return (target as Element).scrollTop ?? 0;
}

/** Zwraca funkcję sprzątającą; wywoływana raz przy starcie aplikacji. */
export function startScrollParallax(root: HTMLElement = document.documentElement): () => void {
  let frame = 0;
  let latest = 0;
  const onScroll = (e: Event) => {
    latest = scrollOffset(e.target);
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      root.style.setProperty(PARALLAX_VAR, String(Math.round(latest)));
    });
  };
  document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  return () => {
    document.removeEventListener("scroll", onScroll, { capture: true });
    if (frame) cancelAnimationFrame(frame);
    root.style.removeProperty(PARALLAX_VAR);
  };
}
