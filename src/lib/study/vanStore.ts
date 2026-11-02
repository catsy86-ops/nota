import { useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import type { VanEvent, VanItem } from "./van";
import { createYVan, type VanState } from "./yVan";

/** Materiał w aucie (H1.3) żyje w dokumencie Yjs notatek (`yVan.ts`); widoki zmieniają go tylko akcjami poniżej. */
const yVan = createYVan(yjsStore.doc);

export const useVan = (): VanState => useSyncExternalStore(yVan.subscribe, yVan.get);
export const getVan = (): VanState => yVan.get();
export const saveVanItem = (item: VanItem) => yVan.saveItem(item);
export const removeVanItem = (id: string) => yVan.removeItem(id);
export const restoreVanItem = (r: { item: VanItem; events: VanEvent[] }) => yVan.restoreItem(r);
export const addVanEvent = (ev: VanEvent) => yVan.addEvent(ev);
export const removeVanEvent = (ev: Pick<VanEvent, "item" | "id">) => yVan.removeEvent(ev);
export const setSiteSupply = (site: string, supply: "site" | "van") => yVan.setSiteSupply(site, supply);

export const vanDump = () => yVan.dump();
export const mergeVanDump = (raw: unknown) => yVan.mergeDump(raw);
