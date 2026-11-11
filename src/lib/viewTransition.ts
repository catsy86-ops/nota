/**
 * Przejścia widoku w obrębie dokumentu (`document.startViewTransition`) tylko tam, gdzie są pewne. W WebKit (Safari i
 * każda przeglądarka na iOS) zawieszały stronę przy szybkim przełączaniu widoków („Old view transition aborted by new
 * view transition”, potem awaria procesu renderującego — test `e2e/workday.spec.ts` na iPhonie 14), więc tam ich nie
 * używamy: zmiana jest natychmiastowa. Chromium zostaje bez zmian. Wyjątek: przejście motywu (`useTheme.ts`) to pojedyncza,
 * rzadka zmiana, nie seria, i zostaje w WebKit (bez niego zmiana wyglądu zachowywała się inaczej w e2e).
 */
export function isWebKitOnly(ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent): boolean {
  return /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg|OPR|Android/.test(ua);
}

type DocWithVT = Document & { startViewTransition?: (cb: () => void) => unknown };

/** Czy wolno użyć przejścia widoku (API jest i to nie WebKit). Ruch ograniczony sprawdza wywołujący. */
export function canViewTransition(): boolean {
  if (typeof document === "undefined") return false;
  return typeof (document as DocWithVT).startViewTransition === "function" && !isWebKitOnly();
}

/** Uruchamia `update` w przejściu widoku, a gdy go nie ma — od razu. */
export function withViewTransition(update: () => void): void {
  if (canViewTransition()) (document as DocWithVT).startViewTransition!(update);
  else update();
}
