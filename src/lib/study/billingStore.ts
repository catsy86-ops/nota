import { useCallback, useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import type { BillingMode, Payment, SiteBilling } from "./billing";
import { createYBilling } from "./yBilling";

/** Sposób rozliczenia budów żyje w dokumencie Yjs notatek (`yBilling.ts`); widoki zmieniają go tylko akcjami poniżej. */
const yBilling = createYBilling(yjsStore.doc);

export function useSiteBilling(site: string): SiteBilling {
  const get = useCallback(() => yBilling.get(site), [site]);
  return useSyncExternalStore(yBilling.subscribe, get);
}

export const getSiteBilling = (site: string) => yBilling.get(site);
export const setBillingModes = (site: string, modes: readonly BillingMode[]) => yBilling.setModes(site, modes);
export const setPointRate = (site: string, typeId: string | null, amount: number | null) => yBilling.setPointRate(site, typeId, amount);
export const setLump = (site: string, amount: number | null) => yBilling.setLump(site, amount);
export const setStageAmount = (site: string, stageId: string, amount: number | null) => yBilling.setStageAmount(site, stageId, amount);

export const addPayment = (site: string, p: Payment) => yBilling.addPayment(site, p);
export const removePayment = (site: string, id: string) => yBilling.removePayment(site, id);

export const billingDump = () => yBilling.dump();
export const mergeBillingDump = (raw: unknown) => yBilling.mergeDump(raw);
export const subscribeBilling = (cb: () => void) => yBilling.subscribe(cb);
