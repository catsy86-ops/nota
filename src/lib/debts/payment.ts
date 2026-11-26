import { createPersistedStore } from "@/lib/persistedStore";
import { cleanAccount, cleanBlik } from "@/lib/paymentDetails";
import { POWLOKA } from "@/lib/storage/names";

/**
 * L2.3 Dane do przelewu dopisywane do wiadomości o długu. Tylko na tym urządzeniu: klucz jest wrażliwy
 * (`keys.ts`) — nie idzie do kopii, synchronizacji ani raportu diagnostycznego, jak konto Pracy.
 * Konto zapisane w postaci kanonicznej (także ze złą sumą — do poprawienia), BLIK tylko poprawny.
 */
export interface DebtPayment {
  account?: string;
  blik?: string;
}

export function cleanDebtPayment(raw: unknown): DebtPayment {
  const r = raw as Partial<DebtPayment> | null;
  if (!r || typeof r !== "object") return {};
  const acc = cleanAccount(r.account).value;
  const blik = cleanBlik(r.blik);
  return { ...(acc ? { account: acc } : {}), ...(blik ? { blik } : {}) };
}

const store = createPersistedStore<DebtPayment>(POWLOKA.debtsPayment, {}, { merge: (_def, stored) => cleanDebtPayment(stored) });

export const useDebtPayment = () => store.use();
export const getDebtPayment = () => store.get();
export const setDebtPayment = (p: DebtPayment) => store.set(cleanDebtPayment(p));
