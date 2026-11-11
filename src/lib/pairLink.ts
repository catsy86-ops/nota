/**
 * Link parowania urządzeń niesie kod grupy. Kod jest jedynym sekretem pokoju, więc leci we fragmencie (`#pair=…`):
 * fragment nie opuszcza przeglądarki, a `?pair=` trafiałby do logów hostingu (S11 audytu). Stare linki `?pair=` nadal działają.
 */
export const pairLink = (origin: string, pathname: string, code: string): string => `${origin}${pathname}#pair=${code}`;

/** Kod z adresu: najpierw fragment, potem stary parametr zapytania. */
export function pairCodeFromLocation(search: string, hash: string): string | null {
  const fromHash = new URLSearchParams(hash.replace(/^#/, "")).get("pair");
  return fromHash || new URLSearchParams(search).get("pair") || null;
}

/** Zdejmuje kod z paska adresu (odświeżenie nie powtórzy akcji, kod nie zostaje w historii). */
export function clearPairFromLocation(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("pair");
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  hash.delete("pair");
  const rest = hash.toString();
  window.history.replaceState(window.history.state, "", url.pathname + url.search + (rest ? `#${rest}` : ""));
}
