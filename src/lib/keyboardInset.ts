/**
 * Wysokość klawiatury ekranowej jako `--kb-inset` na `<html>`.
 *
 * Android (Chrome 108+) z `interactive-widget=resizes-content` sam zmniejsza widok, więc tu
 * wychodzi 0. iOS Safari nie zmienia układu — klawiatura zasłania dół ekranu, a `visualViewport`
 * mówi, ile. Pełnoekranowe edytory odejmują tę wartość, żeby pasek z „Zapisz” był nad klawiaturą.
 */
const MIN_KEYBOARD_PX = 80;

export function installKeyboardInset(): void {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  if (!vv) return;
  const root = document.documentElement;
  let last = -1;
  const update = () => {
    const raw = window.innerHeight - vv.height - vv.offsetTop;
    // Poniżej progu to pasek adresu albo zaokrąglenia, nie klawiatura.
    const inset = raw > MIN_KEYBOARD_PX ? Math.round(raw) : 0;
    if (inset === last) return;
    last = inset;
    root.style.setProperty("--kb-inset", `${inset}px`);
    root.toggleAttribute("data-keyboard", inset > 0);
  };
  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
  update();
}
