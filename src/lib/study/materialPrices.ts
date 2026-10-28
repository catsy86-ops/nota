import { createPersistedStore } from "@/lib/persistedStore";
import { fittingKey } from "./fittings";
import type { PriceList } from "./materialUsage";

/**
 * P2.6: ceny jednostkowe kształtek (zł/szt.) po nazwie. Na urządzeniu, jak nazwa firmy —
 * to cennik użytkownika, nie dane budowy, i nie idzie do dokumentu Nauki ani do kopii.
 */
export const PRICES_KEY = "kaczy.study.prices.v1";
export const PRICE_MAX = 100_000;

const clean = (raw: unknown): PriceList => {
  const out: Record<string, number> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= PRICE_MAX && k.length <= 80) out[k] = Math.round(v * 100) / 100;
    }
  }
  return out;
};

export const pricesStore = createPersistedStore<PriceList>(PRICES_KEY, {}, { merge: (_def, stored) => clean(stored) });

/** Cena dla nazwy kształtki; `null` usuwa cenę. */
export function setFittingPrice(name: string, price: number | null): void {
  const next: Record<string, number> = { ...pricesStore.get() };
  const k = fittingKey(name);
  if (price === null || !Number.isFinite(price) || price < 0) delete next[k];
  else next[k] = Math.min(PRICE_MAX, Math.round(price * 100) / 100);
  pricesStore.set(next);
}

export const usePrices = () => pricesStore.use();
