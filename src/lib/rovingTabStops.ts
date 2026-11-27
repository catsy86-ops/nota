/**
 * Q5.1: w siatce z jednym punktem `Tab` przyciski nieaktywnych kafli („Przypnij”, „Kolor”, pole zaznaczenia…)
 * nie mogą być w kolejce `Tab` — inaczej `Tab` dalej przechodzi przez wszystkie kafle. Zdejmujemy je z kolejki
 * (`tabindex="-1"`) i oddajemy, gdy kafel znów jest aktywny.
 *
 * Ruszamy tylko elementy **bez** własnego `tabindex`: te, które go mają, ustawia React (treść kafla, obrazy —
 * `useIsGridNavTabStop`) i przywrócenie starej wartości nadpisałoby nową. Nowo dorysowane przyciski łapie obserwator.
 */
const FOCUSABLE = "button, a[href], input, select, textarea, summary, [contenteditable=\"true\"]";
const MARK = "data-roving-off";

function suppress(el: Element) {
  // Otwarty edytor kafla zostaje w spokoju — kolejność pól w nim to sprawa edytora.
  if (el.closest("[data-tile-editing]")) return;
  if (el.hasAttribute("tabindex") && !el.hasAttribute(MARK)) return;
  el.setAttribute(MARK, "");
  el.setAttribute("tabindex", "-1");
}

export function suppressTabStops(root: HTMLElement): () => void {
  root.querySelectorAll(FOCUSABLE).forEach(suppress);
  const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (!(n instanceof Element)) return;
        if (n.matches(FOCUSABLE)) suppress(n);
        n.querySelectorAll(FOCUSABLE).forEach(suppress);
      });
    }
  });
  observer?.observe(root, { childList: true, subtree: true });
  return () => {
    observer?.disconnect();
    root.querySelectorAll(`[${MARK}]`).forEach((el) => {
      el.removeAttribute(MARK);
      el.removeAttribute("tabindex");
    });
  };
}
