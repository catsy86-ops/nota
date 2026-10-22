/**
 * Reguły arkusza wpisu bez stanu i bez DOM: jaki komunikat po zapisie, kiedy edycja cofa temat do
 * powtórki, kiedy zaproponować lokalizację budowy. `JournalEntrySheet` tylko je stosuje.
 */

export type JournalKindLite = "ok" | "problem" | "note";

/** Komunikat po zapisie nowego wpisu. Problem na temacie, który był „Umiem”, cofa go do powtórki. */
export function newEntryMessage(kind: JournalKindLite, topicWasDone: boolean): string {
  return kind === "problem" && topicWasDone ? "Zapisano problem — temat wraca do powtórki" : "Zapisano wpis";
}

/** Komunikat po zapisie poprawki. */
export function editSavedMessage(demotes: boolean): string {
  return demotes ? "Zapisano zmiany — temat wraca do powtórki" : "Zapisano zmiany";
}

/**
 * Czy edycja cofa temat do powtórki: problem na temacie „Umiem”, którego wcześniej nie było (albo był
 * innym tematem lub innym rodzajem wpisu).
 */
export function editDemotesTopic(
  next: { kind: JournalKindLite; topic: string },
  prev: { kind: JournalKindLite; topic: string | null } | undefined,
  topicIsDone: boolean,
): boolean {
  return next.kind === "problem" && !!next.topic && topicIsDone && (prev?.kind !== "problem" || prev.topic !== next.topic);
}

/**
 * Czy po zapisie zaproponować zapisanie lokalizacji w karcie budowy: wpis ma lokalizację, budowa jest
 * znana, a karta tej budowy jeszcze nie ma lokalizacji. Nowa budowa (bez karty) też dostaje propozycję.
 */
export function shouldOfferSiteGeo(savedGeo: unknown, siteId: string | undefined, siteHasGeo: boolean): boolean {
  return !!savedGeo && !!siteId && !siteHasGeo;
}
