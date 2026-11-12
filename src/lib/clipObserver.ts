/**
 * Plan Notatek 4.2: fragment treści na kaflu gaśnie tylko wtedy, gdy naprawdę jest ucięty. Jeden wspólny
 * `ResizeObserver` dla wszystkich kafli (zamiast pomiaru w każdej karcie) ustawia `data-clipped`, gdy treść
 * jest wyższa niż pole; CSS (`.tile-fade[data-clipped]`) dokłada wtedy maskę. Bez `ResizeObserver` — bez maski.
 */
let observer: ResizeObserver | null = null;

function shared(): ResizeObserver | null {
  if (observer || typeof ResizeObserver === "undefined") return observer;
  observer = new ResizeObserver((entries) => {
    for (const e of entries) {
      const el = e.target as HTMLElement;
      el.toggleAttribute("data-clipped", el.scrollHeight > el.clientHeight + 1);
    }
  });
  return observer;
}

/** Ref-callback dla pola z `.tile-fade`: obserwuje element, póki jest w DOM. */
export function observeClip(el: HTMLElement | null): (() => void) | void {
  const ro = shared();
  if (!el || !ro) return;
  ro.observe(el);
  return () => ro.unobserve(el);
}
