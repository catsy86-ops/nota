/**
 * Cennik robocizny dla fuch (B4.1). Własne pozycje typu „WC: 350 zł", „wymiana baterii: 120 zł".
 */

export interface PricingItem {
  id: string;
  name: string;           // np. "WC podwieszane", "wymiana baterii"
  price: number;          // cena w zł
  pointType: string;      // typ punktu, do którego dotyczy (np. "H-4" — hydraulika)
  createdAt: number;      // timestamp
}

export interface CompanyPricing {
  items: PricingItem[];   // lista pozycji cennika
}

export const EMPTY_PRICING: CompanyPricing = { items: [] };

export function cleanPricing(data: unknown): CompanyPricing {
  if (!data || typeof data !== "object") return EMPTY_PRICING;
  const obj = data as Record<string, unknown>;
  const items = obj.items;

  if (!Array.isArray(items)) return EMPTY_PRICING;

  return {
    items: items
      .filter((item) => {
        return (
          item &&
          typeof item === "object" &&
          typeof (item as any).id === "string" &&
          typeof (item as any).name === "string" &&
          typeof (item as any).price === "number" &&
          typeof (item as any).pointType === "string" &&
          typeof (item as any).createdAt === "number"
        );
      })
      .map((item) => item as PricingItem),
  };
}

export function addPricingItem(
  pricing: CompanyPricing,
  name: string,
  price: number,
  pointType: string
): CompanyPricing {
  if (!name.trim() || price < 0) return pricing;

  const newItem: PricingItem = {
    id: `pricing-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: name.trim(),
    price,
    pointType,
    createdAt: Date.now(),
  };

  return {
    items: [...pricing.items, newItem],
  };
}

export function removePricingItem(pricing: CompanyPricing, id: string): CompanyPricing {
  return {
    items: pricing.items.filter((item) => item.id !== id),
  };
}
