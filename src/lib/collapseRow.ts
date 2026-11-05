import { isMotionReduced } from "@/hooks/useMotionPref";

/** Ptaszek rysuje się 60 ms + `--dur-base` (motion.css); wiersz zwija się zaraz po nim. */
const TICK_MS = 280;
const COLLAPSE_MS = 220;

/**
 * Jedno odhaczenie (nowy plan 4.2): po „Gotowe” najpierw rysuje się ptaszek, potem
 * wiersz listy (`<li>`) zwija się do zera i dopiero wtedy `commit` zapisuje zmianę —
 * wiersz nie znika w pół kroku. Kafel siatki (bez `<li>`) tylko gaśnie, bo zmiana jego
 * wysokości przestawiłaby cały układ kolumn. Ograniczony ruch: `commit` od razu.
 * Wiersz, który po zapisie zostaje (termin cykliczny przeskakuje na następny raz),
 * wraca do zwykłego wyglądu. Zwraca funkcję, która zapisuje od razu (odmontowanie
 * przed końcem animacji nie gubi zmiany).
 */
export function collapseRowThen(el: HTMLElement, commit: () => void): () => void {
  if (isMotionReduced()) {
    commit();
    return () => {};
  }
  const row = el.closest<HTMLElement>("li") ?? el.closest<HTMLElement>("[data-note-id-wrap]");
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    window.clearTimeout(t1);
    window.clearTimeout(t2);
    commit();
    requestAnimationFrame(() => {
      if (!row?.isConnected) return;
      for (const k of ["height", "overflow", "transition", "paddingTop", "paddingBottom", "opacity"] as const) row.style[k] = "";
    });
  };
  const t1 = window.setTimeout(() => {
    if (!row?.isConnected) return;
    if (row.tagName === "LI") {
      row.style.height = `${row.offsetHeight}px`;
      row.style.overflow = "hidden";
      void row.offsetHeight; // wymusza układ, żeby przejście ruszyło od bieżącej wysokości
      row.style.transition = `height ${COLLAPSE_MS}ms var(--ease-in), opacity ${COLLAPSE_MS}ms var(--ease-in), padding ${COLLAPSE_MS}ms var(--ease-in)`;
      row.style.height = "0px";
      row.style.paddingTop = "0px";
      row.style.paddingBottom = "0px";
    } else {
      row.style.transition = `opacity ${COLLAPSE_MS}ms var(--ease-in)`;
    }
    row.style.opacity = "0";
  }, TICK_MS);
  const t2 = window.setTimeout(finish, TICK_MS + COLLAPSE_MS);
  return finish;
}
