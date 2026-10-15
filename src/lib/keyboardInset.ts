/**
 * Wysokość klawiatury ekranowej jako `--kb-inset` na `<html>` i znacznik `data-typing`.
 *
 * Android (Chrome 108+) z `interactive-widget=resizes-content` sam zmniejsza widok, więc tu
 * wychodzi 0. iOS Safari nie zmienia układu — klawiatura zasłania dół ekranu, a `visualViewport`
 * mówi, ile. Pełnoekranowe edytory odejmują tę wartość, żeby pasek z „Zapisz” był nad klawiaturą.
 *
 * `data-typing` = fokus w polu tekstowym i klawiatura otwarta (iOS: `--kb-inset` > 0; Android:
 * okno niższe niż najwyższe widziane przy tej szerokości). Dolny pasek się wtedy chowa, bo na
 * Androidzie wjeżdża tuż nad klawiaturę i zabiera miejsce na tekst. Sam fokus nie wystarcza —
 * klawiaturę można schować „wstecz”, a pole zostaje aktywne.
 */
const MIN_KEYBOARD_PX = 80;

const NON_TEXT_INPUTS = new Set([
  "button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit",
]);

export function isTextEntry(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly;
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(el.type) && !el.readOnly;
  return el instanceof HTMLElement && el.isContentEditable === true;
}

export function installKeyboardInset(): void {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  if (!vv) return;
  const root = document.documentElement;
  let last = -1;
  // Najwyższe okno przy danej szerokości; obrót ekranu zmienia szerokość i zeruje odniesienie.
  let baseWidth = window.innerWidth;
  let baseHeight = window.innerHeight;

  const update = () => {
    if (window.innerWidth !== baseWidth) {
      baseWidth = window.innerWidth;
      baseHeight = window.innerHeight;
    }
    baseHeight = Math.max(baseHeight, window.innerHeight);

    const raw = window.innerHeight - vv.height - vv.offsetTop;
    // Poniżej progu to pasek adresu albo zaokrąglenia, nie klawiatura.
    const inset = raw > MIN_KEYBOARD_PX ? Math.round(raw) : 0;
    if (inset !== last) {
      last = inset;
      root.style.setProperty("--kb-inset", `${inset}px`);
      root.toggleAttribute("data-keyboard", inset > 0);
    }

    const shrunk = baseHeight - window.innerHeight > MIN_KEYBOARD_PX;
    root.toggleAttribute("data-typing", isTextEntry(document.activeElement) && (inset > 0 || shrunk));
  };

  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
  window.addEventListener("resize", update);
  document.addEventListener("focusin", update);
  // Przy przejściu między polami `activeElement` chwilę wskazuje <body> — liczymy po fokusie.
  document.addEventListener("focusout", () => setTimeout(update, 0));
  update();
}
