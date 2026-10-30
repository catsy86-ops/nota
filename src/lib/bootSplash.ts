/**
 * Ekran startowy z `index.html` (#boot-splash): widoczny tylko w zainstalowanej aplikacji
 * (`display-mode: standalone`) albo z `?splash` w adresie (podgląd). Znika, gdy dane są
 * wczytane, ale nie wcześniej niż po napisaniu „notki” (z kropką nad „i”) — i najpóźniej po 3 s.
 */
const MIN_MS = 1450;
const MIN_MS_REDUCED = 300;
const MAX_MS = 3000;

export function hideBootSplash(ready: Promise<unknown>): void {
  const el = document.getElementById("boot-splash");
  if (!el) return;
  if (new URLSearchParams(window.location.search).has("splash")) document.documentElement.classList.add("boot-force");
  if (getComputedStyle(el).display === "none") {
    el.remove();
    return;
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const min = (reduced ? MIN_MS_REDUCED : MIN_MS) - performance.now();
  const shown = new Promise((r) => window.setTimeout(r, Math.max(0, min)));
  const cap = new Promise((r) => window.setTimeout(r, MAX_MS));
  void Promise.race([Promise.all([ready.catch(() => undefined), shown]), cap]).then(() => {
    requestAnimationFrame(() => {
      el.classList.add("boot-out");
      window.setTimeout(() => el.remove(), 450);
    });
  });
}
