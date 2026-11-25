/**
 * S1.1: Trusted Types. CSP egzekwuje `require-trusted-types-for 'script'` — każde przypisanie napisu do ujścia
 * HTML/skryptu (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `src` skryptu…) przechodzi przez politykę `default`.
 * Kod aplikacji nie ma ujść (strażnik `htmlSinkGuard.test.ts`); jedyny użytkownik to biblioteka Mermaid, która
 * buduje SVG przez `innerHTML` (wynik po DOMPurify, `securityLevel: "strict"`). Polityka przepuszcza HTML tylko
 * wtedy, gdy trwa rysowanie diagramu (`withMermaidSink`, rysunki idą po kolei), a poza tym oknem zwraca `null`,
 * więc przeglądarka blokuje przypisanie. Skryptów w napisach nie przepuszcza nigdy, adresy skryptów tylko z własnego źródła.
 * Przeglądarka bez Trusted Types (Firefox, Safari przed 26): moduł nic nie robi, chroni sam strażnik.
 */

let mermaidDepth = 0;

type TTFactory = { createPolicy: (name: string, rules: Record<string, (input: string) => string | null>) => unknown };

function sameOrigin(input: string): boolean {
  try {
    return new URL(input, location.href).origin === location.origin;
  } catch {
    return false;
  }
}

export function installTrustedTypesPolicy(): void {
  const tt = (globalThis as { trustedTypes?: TTFactory }).trustedTypes;
  if (!tt) return;
  try {
    tt.createPolicy("default", {
      createHTML: (input) => (mermaidDepth > 0 ? input : null),
      createScript: () => null,
      // Service worker (`register("/sw.js")`) i Workery: tylko z własnego źródła (też `blob:` tego źródła) —
      // tyle i tak dopuszcza `script-src 'self'`/`worker-src`, więc polityka niczego nie poszerza.
      createScriptURL: (input) => (sameOrigin(input) ? input : null),
    });
  } catch {
    /* polityka już istnieje (HMR) */
  }
}

/** Okno, w którym Mermaid może pisać HTML. */
export async function withMermaidSink<T>(fn: () => Promise<T>): Promise<T> {
  mermaidDepth++;
  try {
    return await fn();
  } finally {
    mermaidDepth--;
  }
}

installTrustedTypesPolicy();
