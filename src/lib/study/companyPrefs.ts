import { createPersistedStore } from "@/lib/persistedStore";
import { safeLine } from "@/lib/safeText";
import { cleanMileage, EMPTY_MILEAGE, type MileageEntry, type MileageStore } from "./mileage";
import { cleanNotes, QUOTE_NOTES_MAX } from "./quoteNotes";

/**
 * Nazwa firmy na nagłówku protokołu PDF (P2.5, Ustawienia → Praca). Pusta = bez nagłówka.
 * Trzymana na urządzeniu: to dane firmy, nie budowy, więc nie idzie do dokumentu Nauki.
 */
export const COMPANY_NAME_KEY = "kaczy.study.companyName.v1";
export const COMPANY_NAME_MAX = 80;

export const companyNameStore = createPersistedStore<string>(COMPANY_NAME_KEY, "", {
  merge: (def, stored) => (typeof stored === "string" ? stored.slice(0, COMPANY_NAME_MAX) : def),
});

export const setCompanyName = (name: string) => companyNameStore.set(name.slice(0, COMPANY_NAME_MAX));
export const useCompanyName = () => companyNameStore.use();

/** Numer konta do przypomnień o należności (B4.2); na urządzeniu, jak nazwa firmy. Pusty = wiadomość bez konta. */
export const BANK_ACCOUNT_KEY = "kaczy.study.bankAccount.v1";
export const BANK_ACCOUNT_MAX = 40;

export const bankAccountStore = createPersistedStore<string>(BANK_ACCOUNT_KEY, "", {
  merge: (def, stored) => (typeof stored === "string" ? safeLine(stored).slice(0, BANK_ACCOUNT_MAX) : def),
});

export const setBankAccount = (v: string) => bankAccountStore.set(safeLine(v).slice(0, BANK_ACCOUNT_MAX));
export const useBankAccount = () => bankAccountStore.use();

/**
 * Domyślne uwagi i warunki wyceny (plan wycen i klientów, 3.3): termin realizacji, zaliczka, gwarancja. Wstawiane do wyceny
 * przyciskiem „Wstaw domyślne warunki”, a nie dopisywane samo — zmiana domyślnego tekstu nie zmienia wycen już wysłanych.
 * Na urządzeniu, jak nazwa firmy; wchodzi do kopii zapasowej wśród ustawień.
 */
export const QUOTE_TERMS_KEY = "kaczy.study.quoteTerms.v1";
export const quoteTermsStore = createPersistedStore<string>(QUOTE_TERMS_KEY, "", {
  merge: (def, stored) => (typeof stored === "string" ? cleanNotes(stored) : def),
});
export const setQuoteTerms = (v: string) => quoteTermsStore.set(cleanNotes(v).slice(0, QUOTE_NOTES_MAX));
export const useQuoteTerms = () => quoteTermsStore.use();

/**
 * B4.1 Cennik robocizny dla fuch (własne pozycje typu „WC: 350 zł"). Od planu wycen i klientów (4.1) w dokumencie Yjs
 * (`pricingStore.ts`, `yPricing.ts`), razem z cenami kształtek — synchronizuje się między urządzeniami.
 */

/**
 * B4.3 Kilometrówka: przejazdy i ostatnia stawka. Na urządzeniu (jak cennik) — to rozliczenie osoby, nie budowy,
 * więc nie idzie do wspólnego dokumentu ani do synchronizacji.
 */
export const MILEAGE_KEY = "kaczy.study.mileage.v1";

export const mileageStore = createPersistedStore<MileageStore>(MILEAGE_KEY, EMPTY_MILEAGE, {
  merge: (_def, stored) => cleanMileage(stored),
});

export const useMileage = () => mileageStore.use();

/** Dopisuje przejazd i zapamiętuje jego stawkę jako domyślną. Zwraca `false`, gdy magazyn odrzucił dane (np. limit wpisów). */
export function addMileageEntry(entry: MileageEntry): boolean {
  const cur = mileageStore.get();
  const next = cleanMileage({ rate: entry.rate, entries: [...cur.entries, entry] });
  if (!next.entries.some((e) => e.id === entry.id)) return false;
  mileageStore.set(next);
  return true;
}

export function removeMileageEntry(id: string): MileageEntry | undefined {
  const cur = mileageStore.get();
  const gone = cur.entries.find((e) => e.id === id);
  if (gone) mileageStore.set({ ...cur, entries: cur.entries.filter((e) => e.id !== id) });
  return gone;
}

/**
 * H5.1 Autor: imię osoby na tym urządzeniu („Marek”) dopisywane do nowych wpisów, braków i kroków punktów
 * (pole `by`). Na urządzeniu, nie w dokumencie — każdy telefon to inna osoba. Pusty = bez autora.
 */
export const AUTHOR_KEY = "kaczy.study.author.v1";
export const AUTHOR_MAX = 40;
export const cleanAuthor = (v: unknown): string | undefined => {
  const t = typeof v === "string" ? safeLine(v).slice(0, AUTHOR_MAX) : "";
  return t || undefined;
};
export const authorStore = createPersistedStore<string>(AUTHOR_KEY, "", {
  merge: (def, stored) => cleanAuthor(stored) ?? def,
});
export const setAuthor = (name: string) => authorStore.set(cleanAuthor(name) ?? "");
export const useAuthor = () => authorStore.use();
/** Autor do zapisu; `undefined` = nie ustawiony. */
export const currentAuthor = () => cleanAuthor(authorStore.get());
/** Kogo pokazać przy pozycji: autor inny niż osoba na tym urządzeniu (swoje wpisy bez podpisu). */
export const otherAuthor = (by: string | undefined, me: string) => (by && by !== me ? by : undefined);
