import { useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import type { Kit } from "./kits";
import { createYKits, type KitsState } from "./yKits";

/** Zestawy materiału żyją w dokumencie Yjs notatek (`yKits.ts`); widoki zmieniają je tylko akcjami poniżej. */
const yKits = createYKits(yjsStore.doc);

export function useKits(): KitsState {
  return useSyncExternalStore(yKits.subscribe, yKits.get);
}

export const getKits = () => yKits.get();
export const saveKit = (kit: Kit) => yKits.save(kit);
export const removeKit = (id: string) => yKits.remove(id);
export const restoreKit = (kit: Kit) => yKits.save(kit);
export const kitsDump = () => yKits.dump();
export const mergeKitsDump = (raw: unknown) => yKits.mergeDump(raw);
