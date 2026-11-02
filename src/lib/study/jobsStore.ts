import { useCallback, useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import type { Job, JobMeta, QuoteItem } from "./jobs";
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
export const saveQuoteItem = (site: string, item: QuoteItem) => yJobs.saveItem(site, item);
export const removeQuoteItem = (site: string, id: string) => yJobs.removeItem(site, id);
export const removeJob = (site: string) => yJobs.remove(site);
export const restoreJob = (site: string, job: Job) => yJobs.restore(site, job);

export const jobsDump = () => yJobs.dump();
export const mergeJobsDump = (raw: unknown) => yJobs.mergeDump(raw);
