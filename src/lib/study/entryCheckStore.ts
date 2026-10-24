import { useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import { enterSite, leaveSite, recordKey, reopenCheck, toggleCheck, unleaveSite, type CheckItem } from "./entryCheck";
import { createYEntryCheck, type EntryCheckState } from "./yEntryCheck";

/** Lista przed wejściem żyje w dokumencie Yjs notatek (`yEntryCheck.ts`); widoki zmieniają ją tylko akcjami poniżej. */
const yEntryCheck = createYEntryCheck(yjsStore.doc);

export function useEntryCheck(): EntryCheckState {
  return useSyncExternalStore(yEntryCheck.subscribe, yEntryCheck.get);
}

const recordOf = (site: string, day: string) => yEntryCheck.get().records.get(recordKey(site, day));

export function toggleEntryCheck(site: string, day: string, itemId: string): void {
  yEntryCheck.setRecord(toggleCheck(recordOf(site, day), site, day, itemId));
}

export function enterEntryCheck(site: string, day: string, at: number = Date.now()): void {
  yEntryCheck.setRecord(enterSite(recordOf(site, day), site, day, at));
}

/** „Wychodzę” — godzina wyjścia; podpowiada godziny budowy w oknie „Godziny na budowach”. */
export function leaveEntryCheck(site: string, day: string, at: number = Date.now()): void {
  const r = recordOf(site, day);
  if (r) yEntryCheck.setRecord(leaveSite(r, at));
}

export function unleaveEntryCheck(site: string, day: string): void {
  const r = recordOf(site, day);
  if (r) yEntryCheck.setRecord(unleaveSite(r));
}

export function reopenEntryCheck(site: string, day: string): void {
  const r = recordOf(site, day);
  if (r) yEntryCheck.setRecord(reopenCheck(r));
}

export function saveEntryCheckItems(items: readonly CheckItem[]): void {
  yEntryCheck.setItems(items);
}

export function resetEntryCheckItems(): void {
  yEntryCheck.setItems(null);
}

export const entryCheckDump = () => yEntryCheck.dump();
export const mergeEntryCheckDump = (raw: unknown) => yEntryCheck.mergeDump(raw);
