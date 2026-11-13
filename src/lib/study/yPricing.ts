import * as Y from "yjs";
import { cleanPricing, PRICING_ITEMS_MAX, type CompanyPricing, type PricingItem } from "@/lib/pricing";
import { fittingKey } from "./fittings";
import type { PriceList } from "./materialUsage";
import { cleanTemplate, TEMPLATES_MAX, type QuoteTemplate } from "./quoteTemplates";

/**
 * Cenniki w Y.Doc notatek (plan wycen i klientów, 4.1) — synchronizacja i kopia jak reszta danych. Wcześniej leżały
 * w `localStorage` urządzenia, więc wycena z telefonu i z komputera miała różne ceny. Mapa `studyPricing`:
 * `l␁id` pozycja cennika robocizny `{ name, price, pointType, createdAt }`, `m␁klucz` cena kształtki (klucz = `fittingKey`,
 * czyli nazwa bez ogonków i wielkości liter), `t␁id` szablon wyceny (`quoteTemplates.ts`, 4.3). Każda pozycja ma własny klucz: dwa telefony dodające różne pozycje scalają się
 * bez strat. Stare dane z `localStorage` wchodzą z kluczami **deterministycznymi** (z nazwy, ceny i typu), więc ta sama
 * pozycja zaimportowana na dwóch telefonach to jeden wpis, a nie dwa.
 */

export const PRICING_ORIGIN = "pricing";
export const MATERIAL_PRICES_MAX = 1000;
export const MATERIAL_PRICE_MAX = 100_000;
const LABOR = "l\u0001";
const MATERIAL = "m\u0001";
const TEMPLATE = "t\u0001";

export interface PricingDump {
  labor: PricingItem[];
  materials: Record<string, number>;
  templates: QuoteTemplate[];
}

const cleanMaterial = (k: unknown, v: unknown): number | undefined =>
  typeof k === "string" && k.length > 0 && k.length <= 80 && typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= MATERIAL_PRICE_MAX
    ? Math.round(v * 100) / 100 : undefined;

export function createYPricing(doc: Y.Doc) {
  const map = doc.getMap<unknown>("studyPricing");
  let snapshot: { labor: CompanyPricing; materials: PriceList; templates: QuoteTemplate[] } | null = null;
  const listeners = new Set<() => void>();
  map.observe(() => {
    snapshot = null;
    listeners.forEach((l) => l());
  });

  function build() {
    if (snapshot) return snapshot;
    const rawItems: unknown[] = [];
    const materials: Record<string, number> = {};
    const templates: QuoteTemplate[] = [];
    for (const [k, v] of map.entries()) {
      if (k.startsWith(TEMPLATE)) { const t = cleanTemplate(v, k.slice(TEMPLATE.length)); if (t) templates.push(t); continue; }
      if (k.startsWith(LABOR)) rawItems.push({ ...(v as object), id: k.slice(LABOR.length) });
      else if (k.startsWith(MATERIAL)) {
        const key = k.slice(MATERIAL.length);
        const p = cleanMaterial(key, v);
        if (p !== undefined) materials[key] = p;
      }
    }
    // Starsze pozycje pierwsze; `cleanPricing` odrzuca śmieci i przycina do limitu.
    rawItems.sort((a, b) => ((a as PricingItem).createdAt ?? 0) - ((b as PricingItem).createdAt ?? 0) || String((a as PricingItem).id).localeCompare(String((b as PricingItem).id)));
    templates.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    snapshot = { labor: cleanPricing({ items: rawItems }), materials, templates: templates.slice(0, TEMPLATES_MAX) };
    return snapshot;
  }

  const labor = (): CompanyPricing => build().labor;
  const materials = (): PriceList => build().materials;
  const templates = (): QuoteTemplate[] => build().templates;

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  const laborValue = (i: PricingItem) => ({ name: i.name, price: i.price, pointType: i.pointType, createdAt: i.createdAt });

  /**
   * Ustawia cały cennik robocizny jak dawne `setPricing`: nowe id dochodzą, brakujące znikają, zmienione są nadpisywane.
   * Pozycje poza limitem są pomijane.
   */
  function setLabor(next: CompanyPricing): void {
    const clean = cleanPricing(next).items;
    const keep = new Set(clean.map((i) => LABOR + i.id));
    doc.transact(() => {
      for (const k of [...map.keys()]) if (k.startsWith(LABOR) && !keep.has(k)) map.delete(k);
      for (const i of clean) map.set(LABOR + i.id, laborValue(i));
    }, PRICING_ORIGIN);
  }

  /** Cena kształtki po nazwie; `null` ją usuwa. `false` = zła cena albo pełna lista. */
  function setMaterial(key: string, price: number | null): boolean {
    const k = MATERIAL + key;
    if (price === null) {
      if (map.has(k)) doc.transact(() => map.delete(k), PRICING_ORIGIN);
      return true;
    }
    const p = cleanMaterial(key, price);
    if (p === undefined) return false;
    if (!map.has(k) && Object.keys(build().materials).length >= MATERIAL_PRICES_MAX) return false;
    doc.transact(() => map.set(k, p), PRICING_ORIGIN);
    return true;
  }

  /** Zapisuje szablon (nowy albo ten sam id nadpisany); `false` = zły szablon albo pełna lista. */
  function saveTemplate(t: QuoteTemplate): boolean {
    const clean = cleanTemplate(t, t.id);
    if (!clean) return false;
    if (!map.has(TEMPLATE + clean.id) && templates().length >= TEMPLATES_MAX) return false;
    const { id, ...value } = clean;
    doc.transact(() => map.set(TEMPLATE + id, value), PRICING_ORIGIN);
    return true;
  }

  /** Usuwa szablon; zwraca go do „Cofnij”. */
  function removeTemplate(id: string): QuoteTemplate | null {
    const prev = templates().find((t) => t.id === id) ?? null;
    if (map.has(TEMPLATE + id)) doc.transact(() => map.delete(TEMPLATE + id), PRICING_ORIGIN);
    return prev;
  }

  function dump(): PricingDump {
    return { labor: labor().items, materials: { ...materials() }, templates: templates() };
  }

  /**
   * Scala dane (kopia albo import ze starego `localStorage`): dodaje pozycje i ceny, których tu nie ma, w limitach;
   * niczego nie kasuje ani nie nadpisuje. `deterministic` nadaje pozycjom robocizny id z treści (`legacyId`), żeby ta sama
   * pozycja z dwóch telefonów dała jeden wpis.
   */
  function mergeDump(raw: unknown, deterministic = false): void {
    const d = raw as Partial<PricingDump> | null;
    if (!d || typeof d !== "object") return;
    const items = cleanPricing({ items: Array.isArray(d.labor) ? d.labor : [] }).items;
    doc.transact(() => {
      let count = labor().items.length;
      for (const i of items) {
        const id = deterministic ? legacyId(i) : i.id;
        if (map.has(LABOR + id) || count >= PRICING_ITEMS_MAX) continue;
        map.set(LABOR + id, laborValue(i));
        count++;
      }
      if (Array.isArray(d.templates)) {
        let tCount = templates().length;
        for (const raw of d.templates.slice(0, TEMPLATES_MAX)) {
          const id = (raw as Partial<QuoteTemplate> | null)?.id;
          const t = typeof id === "string" ? cleanTemplate(raw, id) : null;
          if (!t || map.has(TEMPLATE + t.id) || tCount >= TEMPLATES_MAX) continue;
          const { id: _id, ...value } = t;
          map.set(TEMPLATE + t.id, value);
          tCount++;
        }
      }
      if (d.materials && typeof d.materials === "object") {
        let mCount = Object.keys(materials()).length;
        for (const [key, v] of Object.entries(d.materials).slice(0, MATERIAL_PRICES_MAX)) {
          const p = cleanMaterial(key, v);
          if (p === undefined || map.has(MATERIAL + key) || mCount >= MATERIAL_PRICES_MAX) continue;
          map.set(MATERIAL + key, p);
          mCount++;
        }
      }
    }, PRICING_ORIGIN);
  }

  return { labor, materials, templates, subscribe, setLabor, setMaterial, saveTemplate, removeTemplate, dump, mergeDump };
}

/** Id pozycji ze starego cennika: ten sam tekst na każdym telefonie daje to samo id (FNV-1a z nazwy, ceny i typu). */
export function legacyId(i: Pick<PricingItem, "name" | "price" | "pointType">): string {
  let h = 0x811c9dc5;
  for (const ch of `${fittingKey(i.name)}|${i.price.toFixed(2)}|${i.pointType}`) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `pl-${h.toString(16).padStart(8, "0")}`;
}
