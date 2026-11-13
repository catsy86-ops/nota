import { addPayment, removePayment } from "./billingStore";
import type { Job } from "./jobs";
import { setQuoteDoc } from "./jobsStore";

/**
 * Zaliczka na wycenie (plan wycen i klientów, 5.3). „Wpłynęła zaliczka” zapisuje zwykłą wpłatę w rozliczeniach budowy
 * (`billingStore`, ta sama co w „Należnościach” i w zestawieniu miesiąca) pod stałym id, więc ponowne kliknięcie nie dubluje
 * wpłaty, i kopiuje kwotę do dokumentu wyceny (`depositPaid`), skąd liczą się „Do zapłaty”, PDF i „Niezapłacone”.
 */

export const DEPOSIT_PAYMENT_ID = "quote-deposit";

/** `false` = wycena nie ma zaliczki albo wpłaty nie udało się zapisać (np. limit wpłat budowy). */
export function receiveDeposit(siteId: string, job: Pick<Job, "doc">, day: string): boolean {
  const amount = job.doc?.deposit;
  if (!amount) return false;
  const note = `Zaliczka${job.doc?.number ? ` — ${job.doc.number}` : ""}`;
  if (!addPayment(siteId, { id: DEPOSIT_PAYMENT_ID, day, amount, note })) return false;
  return setQuoteDoc(siteId, { depositPaid: amount });
}

/** Cofa wpłatę zaliczki (pomyłka): usuwa ją z rozliczeń i z dokumentu wyceny. */
export function revertDeposit(siteId: string): void {
  removePayment(siteId, DEPOSIT_PAYMENT_ID);
  setQuoteDoc(siteId, { depositPaid: undefined });
}
