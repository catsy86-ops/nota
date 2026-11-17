/**
 * Link parowania urządzeń niesie kod grupy. Kod jest jedynym sekretem pokoju, więc leci we fragmencie (`#pair=…`):
 * fragment nie opuszcza przeglądarki, a `?pair=` trafiałby do logów hostingu (S11 audytu). Stare linki `?pair=` nadal działają.
 *
 * `&v=3` (S2.6) mówi dołączającemu, że grupa nie ma pokoju v2 — nie otwiera wtedy okna zgodności i szybki
 * skrót kodu nie trafia bez potrzeby do serwerów sygnalizacyjnych.
 */
export const pairLink = (origin: string, pathname: string, code: string, v3 = false): string =>
  `${origin}${pathname}#pair=${code}${v3 ? "&v=3" : ""}`;

/** Kod z adresu: najpierw fragment, potem stary parametr zapytania. */
export function pairCodeFromLocation(search: string, hash: string): string | null {
  const fromHash = new URLSearchParams(hash.replace(/^#/, "")).get("pair");
  return fromHash || new URLSearchParams(search).get("pair") || null;
}

/** Czy tekst (adres, wklejony link, odczyt z QR) to link parowania z `v=3`. */
export function pairTextIsV3(text: string): boolean {
  return /[?&#]pair=[^&#\s]+/.test(text) && /[?&#]v=3(?=[&#\s]|$)/.test(text);
}

/** Zdejmuje kod z paska adresu (odświeżenie nie powtórzy akcji, kod nie zostaje w historii). */
export function clearPairFromLocation(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("pair");
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const hadPair = hash.has("pair");
  hash.delete("pair");
  if (hadPair) hash.delete("v");
  const rest = hash.toString();
  window.history.replaceState(window.history.state, "", url.pathname + url.search + (rest ? `#${rest}` : ""));
}
