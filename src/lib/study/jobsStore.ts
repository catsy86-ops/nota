import { useCallback, useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import type { Job, JobMeta, QuoteItem } from "./jobs";
import { localDayKey } from "@/lib/dayDone";
import { seriesStore } from "@/lib/ksef/sellerPrefs";
import { nextQuoteNumber, quoteStamp, quoteState, type QuoteDoc } from "./quoteDoc";
import { createYJobs } from "./yJobs";

/** Zlecenia własne (H3.4) żyją w dokumencie Yjs notatek (`yJobs.ts`); widoki zmieniają je tylko akcjami poniżej. */
const yJobs = createYJobs(yjsStore.doc);

/** Zlecenie budowy; `undefined` = zwykła budowa (szefa). */
export function useJob(site: string): Job | undefined {
  const get = useCallback(() => yJobs.get(site), [site]);
  return useSyncExternalStore(yJobs.subscribe, get);
}

/** Wszystkie zlecenia: id budowy → zlecenie. */
export function useJobs(): ReadonlyMap<string, Job> {
  return useSyncExternalStore(yJobs.subscribe, yJobs.all);
}

export const getJobs = (): ReadonlyMap<string, Job> => yJobs.all();
export const setJobMeta = (site: string, patch: Partial<JobMeta>) => yJobs.setMeta(site, patch);
/** Zmiana dokumentu wyceny (numer, daty, VAT, rabat, uwagi, stan); pole `undefined` je zdejmuje. */
export const setQuoteDoc = (site: string, patch: Partial<QuoteDoc>) => yJobs.setDoc(site, patch);

/**
 * Nadaje wycenie numer (`W/{seria}/{rok}/{kolejny}`) i datę wystawienia, jeśli jeszcze ich nie ma; ma numer — nic nie zmienia.
 * Termin ważności nie jest zapisywany (domyślnie +14 dni liczone z daty wystawienia), więc nadanie numeru nie unieważnia podpisu.
 * Zwraca dokument po zmianie albo `null`, gdy budowa nie jest zleceniem.
 */
export function ensureQuoteNumber(site: string, today: string = localDayKey(), series: string = seriesStore.get()): QuoteDoc | null {
  const job = yJobs.get(site);
  if (!job) return null;
  if (job.doc?.number) return job.doc;
  const taken = [...yJobs.all().values()].flatMap((j) => (j.doc?.number ? [j.doc.number] : []));
  const number = nextQuoteNumber(series, Number(today.slice(0, 4)), taken);
  yJobs.setDoc(site, { number, issued: job.doc?.issued ?? today });
  return yJobs.get(site)?.doc ?? null;
}
/**
 * Oznacza wycenę jako wysłaną klientowi. Idempotentne: poza szkicem nowe wysłanie liczy się dopiero po zmianie treści wyceny
 * od ostatniego znacznika (wysłania, przyjęcia albo odrzucenia). Kolejny PDF tej samej treści (ponowne pobranie, wydruk
 * podpisanej kopii) nie przesuwa daty ani nie cofa „przyjętej” do „wysłanej” — licznik „wysłana N dni temu” i przypomnienie
 * o braku odpowiedzi liczą się od pierwszego wysłania.
 */
export function markQuoteSent(site: string, now: number = Date.now()): boolean {
  const job = yJobs.get(site);
  if (!job) return false;
  if (quoteState(job.doc) !== "draft" && (job.changedAt ?? 0) <= quoteStamp(job.doc)) return false;
  return yJobs.setDoc(site, { sentAt: now });
}
export const saveQuoteItem = (site: string, item: QuoteItem) => yJobs.saveItem(site, item);
export const removeQuoteItem = (site: string, id: string) => yJobs.removeItem(site, id);
export const removeJob = (site: string) => yJobs.remove(site);
export const restoreJob = (site: string, job: Job) => yJobs.restore(site, job);

export const jobsDump = () => yJobs.dump();
export const mergeJobsDump = (raw: unknown) => yJobs.mergeDump(raw);
