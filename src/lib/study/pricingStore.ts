import { useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import { cleanPricing, type CompanyPricing } from "@/lib/pricing";
import { fittingKey } from "./fittings";
import type { PriceList } from "./materialUsage";
import type { QuoteTemplate } from "./quoteTemplates";
import { createYPricing } from "./yPricing";

/** Cenniki żyją w dokumencie Yjs notatek (`yPricing.ts`); widoki zmieniają je tylko akcjami poniżej. */
const yPricing = createYPricing(yjsStore.doc);

/** Klucze `localStorage` sprzed synchronizacji cenników (4.1) — czytane już tylko do jednorazowego importu. */
export const LEGACY_PRICING_KEY = "kaczy.study.pricing.v1";
export const LEGACY_PRICES_KEY = "kaczy.study.prices.v1";

export const usePricing = (): CompanyPricing => useSyncExternalStore(yPricing.subscribe, yPricing.labor);
export const getPricing = (): CompanyPricing => yPricing.labor();
/** Cały cennik robocizny naraz (jak dawne `setPricing`): nowe pozycje dochodzą, brakujące znikają. */
export const setPricing = (next: CompanyPricing) => yPricing.setLabor(next);

export const usePrices = (): PriceList => useSyncExternalStore(yPricing.subscribe, yPricing.materials);
export const getPrices = (): PriceList => yPricing.materials();
/** Cena kształtki po nazwie; `null` usuwa cenę. `false` = zła cena albo pełna lista. */
export const setFittingPrice = (name: string, price: number | null): boolean => yPricing.setMaterial(fittingKey(name), price);

export const useTemplates = (): QuoteTemplate[] => useSyncExternalStore(yPricing.subscribe, yPricing.templates);
export const getTemplates = (): QuoteTemplate[] => yPricing.templates();
export const saveTemplate = (t: QuoteTemplate) => yPricing.saveTemplate(t);
export const removeTemplate = (id: string) => yPricing.removeTemplate(id);

export const pricingDump = () => yPricing.dump();
export const mergePricingDump = (raw: unknown) => yPricing.mergeDump(raw);

/**
 * Jednorazowy import cenników z `localStorage` (sprzed 4.1) do dokumentu i usunięcie starych kluczy — dzięki temu pozycja
 * skasowana już w Yjs nie wraca przy następnym uruchomieniu. Wołane przy starcie modułu i po przywróceniu starej kopii
 * (która zapisuje te klucze wśród ustawień). Id pozycji z treści: ten sam wpis z dwóch telefonów to jeden wpis.
 */
export function importLegacyPricing(storage: Pick<Storage, "getItem" | "removeItem"> | null = safeStorage()): boolean {
  if (!storage) return false;
  let labor: unknown;
  let materials: unknown;
  try {
    const l = storage.getItem(LEGACY_PRICING_KEY);
    const m = storage.getItem(LEGACY_PRICES_KEY);
    if (l === null && m === null) return false;
    labor = l ? cleanPricing(JSON.parse(l)).items : [];
    materials = m ? JSON.parse(m) : {};
  } catch {
    // Uszkodzony stary zapis: nie ma czego importować; usuwamy go, żeby nie wracał przy każdym starcie.
    try { storage.removeItem(LEGACY_PRICING_KEY); storage.removeItem(LEGACY_PRICES_KEY); } catch { /* bez dostępu */ }
    return false;
  }
  yPricing.mergeDump({ labor, materials }, true);
  try { storage.removeItem(LEGACY_PRICING_KEY); storage.removeItem(LEGACY_PRICES_KEY); } catch { /* bez dostępu */ }
  return true;
}

function safeStorage(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

// Dopiero po wczytaniu dokumentu z dysku: stare klucze znikają, gdy import trafił już na pełny stan Yjs, a nie na pusty
// (zamknięcie karty tuż po starcie nie gubi wtedy cennika). Błąd wczytania zostawia stare klucze na następny start.
void yjsStore.ready().then(() => importLegacyPricing()).catch(() => undefined);
