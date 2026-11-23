import { createPersistedStore } from "@/lib/persistedStore";
import { formatAmount } from "@/lib/debts/model";
import { POWLOKA } from "@/lib/storage/names";

/** Zamiennik kwoty, gdy ukrywanie jest włączone (plan długów 3.3). */
export const HIDDEN_AMOUNT = "•••";

// Ukrywanie działa tylko na tym urządzeniu — zapis lokalny, nie idzie do Yjs.
const store = createPersistedStore<boolean>(POWLOKA.debtsHideAmounts, false, {
  merge: (defaults, stored) => (typeof stored === "boolean" ? stored : defaults),
});

export function setHideAmounts(value: boolean) {
  store.set(value);
}

export function getHideAmounts(): boolean {
  return store.get();
}

export function useHideAmounts(): boolean {
  return store.use();
}

/** Kwota w groszach jako tekst albo „•••”, gdy ukryta. */
export function amountText(grosze: number, hidden: boolean): string {
  return hidden ? HIDDEN_AMOUNT : formatAmount(grosze);
}
