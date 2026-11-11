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
      .filter((item): item is PricingItem => {
        if (!item || typeof item !== "object") return false;
        const o = item as Record<string, unknown>;
        return (
          typeof o.id === "string" &&
          typeof o.name === "string" &&
          typeof o.price === "number" && Number.isFinite(o.price) &&
          typeof o.pointType === "string" &&
          typeof o.createdAt === "number"
        );
      }),
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
