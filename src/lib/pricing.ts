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

export const PRICING_ITEMS_MAX = 100;
export const PRICING_NAME_MAX = 80;
export const PRICING_PRICE_MAX = 10_000_000;
const POINT_TYPE_MAX = 20;

export function cleanPricing(data: unknown): CompanyPricing {
  if (!data || typeof data !== "object") return EMPTY_PRICING;
  const obj = data as Record<string, unknown>;
  const items = obj.items;

  if (!Array.isArray(items)) return EMPTY_PRICING;

  const clean: PricingItem[] = [];
  for (const raw of items) {
    if (clean.length >= PRICING_ITEMS_MAX) break;
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    if (typeof o.id !== "string" || !o.id || o.id.length > 64) continue;
    const name = typeof o.name === "string" ? o.name.replace(/\s+/g, " ").trim().slice(0, PRICING_NAME_MAX) : "";
    if (!name) continue;
    if (typeof o.price !== "number" || !Number.isFinite(o.price) || o.price < 0 || o.price > PRICING_PRICE_MAX) continue;
    if (typeof o.pointType !== "string" || typeof o.createdAt !== "number") continue;
    clean.push({ id: o.id, name, price: Math.round(o.price * 100) / 100, pointType: o.pointType.slice(0, POINT_TYPE_MAX), createdAt: o.createdAt });
  }
  return { items: clean };
}

export function addPricingItem(
  pricing: CompanyPricing,
  name: string,
  price: number,
  pointType: string
): CompanyPricing {
  if (!name.trim() || !Number.isFinite(price) || price < 0 || price > PRICING_PRICE_MAX) return pricing;
  if (pricing.items.length >= PRICING_ITEMS_MAX) return pricing;

  const newItem: PricingItem = {
    id: `pricing-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: name.replace(/\s+/g, " ").trim().slice(0, PRICING_NAME_MAX),
    price: Math.round(price * 100) / 100,
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
