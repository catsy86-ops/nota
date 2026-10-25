/**
 * Link prosto do karty budowy: `/praca?budowa=<id>` (2.1 planu Praca 2026-10-24).
 * Używa tego wiersz „Dziś”, push (serwis, dostawa) i `StudyJournal`, który po wejściu otwiera kartę.
 * Parametr zdejmowany z adresu po odczycie — jak `JOURNAL_REPORT_PARAM` w `reportLink.ts`, żeby odświeżenie nie otwierało karty ponownie.
 */
export const SITE_PARAM = "budowa";

/** Adres karty budowy, np. `/praca?budowa=abc`. */
export function siteCardUrl(siteId: string): string {
  return `/praca?${SITE_PARAM}=${encodeURIComponent(siteId)}`;
}

/** Id budowy z adresu bez zmiany adresu; `null` gdy parametru nie ma albo jest pusty. */
export function readSiteParam(search: string = typeof window === "undefined" ? "" : window.location.search): string | null {
  const id = new URLSearchParams(search).get(SITE_PARAM);
  return id ? id : null;
}

/** Odczytuje id budowy i zdejmuje parametr z adresu (`replaceState`, bez nowego wpisu w historii). */
export function takeSiteParam(): string | null {
  const id = readSiteParam();
  if (id === null) return null;
  const params = new URLSearchParams(window.location.search);
  params.delete(SITE_PARAM);
  const rest = params.toString();
  window.history.replaceState(window.history.state, "", window.location.pathname + (rest ? `?${rest}` : ""));
  return id;
}
