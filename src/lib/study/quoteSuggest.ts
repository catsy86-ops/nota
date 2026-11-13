import type { CompanyPricing } from "@/lib/pricing";
import { FITTING_SUGGESTIONS, fittingKey } from "./fittings";
import { priceOf, type PriceList } from "./materialUsage";
import type { QuoteKind } from "./jobs";

/**
 * Podpowiedzi do formularza pozycji wyceny (plan wycen i klientów, 4.2): materiał z cennika kształtek i cena po nazwie.
 * Czyste funkcje nad cennikami z `pricingStore.ts`; formularz tylko je woła.
 */

export interface PriceChip {
  name: string;
  price: number;
}

/**
 * Kształtki z katalogu podpowiedzi, które mają cenę w cenniku (nazwa z ogonkami z katalogu, nie złożony klucz cennika).
 * Własne nazwy spoza katalogu mają cenę, ale chip dla nich pojawi się dopiero, gdy wpiszesz nazwę (`suggestPrice`).
 */
export function materialChips(prices: PriceList): PriceChip[] {
  return FITTING_SUGGESTIONS.flatMap((name) => {
    const price = priceOf(prices, name);
    return price === undefined ? [] : [{ name, price }];
  });
}

/**
 * Cena z cennika dla wpisanej nazwy pozycji: robocizna z cennika robocizny (nazwa bez ogonków i wielkości liter),
 * materiał z cennika kształtek. `undefined` = brak dopasowania; pusta nazwa nigdy nie pasuje.
 */
export function suggestPrice(kind: QuoteKind, name: string, pricing: CompanyPricing, prices: PriceList): number | undefined {
  const key = fittingKey(name);
  if (!key) return undefined;
  if (kind === "material") return priceOf(prices, name);
  return pricing.items.find((i) => fittingKey(i.name) === key)?.price;
}
