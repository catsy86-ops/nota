import { safeLine } from "@/lib/safeText";
import { cleanMargin, cleanQuoteItem, QUOTE_ITEMS_MAX, type Job, type QuoteItem } from "./jobs";

/**
 * Szablony wycen (plan wycen i klientów, 4.3): zestaw pozycji pod nazwą, np. „Łazienka — biały montaż”. „Zapisz jako
 * szablon” robi migawkę pozycji wyceny (ceny z chwili zapisu), „Wstaw szablon” dopisuje je do wyceny bez kasowania tego,
 * co już jest. Zapis w mapie `studyPricing` (`yPricing.ts`), więc szablony synchronizują się razem z cennikami.
 */

export const TEMPLATES_MAX = 50;
export const TEMPLATE_NAME_MAX = 60;

/** Pozycja szablonu: pozycja wyceny bez id i kolejności (te nadaje wstawienie). */
export type TemplateItem = Pick<QuoteItem, "kind" | "name" | "qty" | "unit" | "price">;

export interface QuoteTemplate {
  id: string;
  name: string;
  items: TemplateItem[];
  /** Marża na materiał z wyceny źródłowej; wstawiana tylko do wyceny, która jej jeszcze nie ma. */
  margin?: number;
  createdAt: number;
}

const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;

/** Szablon z dowolnego wejścia (Yjs, kopia, peer) albo `null` (bez nazwy albo bez żadnej poprawnej pozycji). */
export function cleanTemplate(raw: unknown, id: string): QuoteTemplate | null {
  const t = raw as Partial<QuoteTemplate> | null;
  if (!t || typeof t !== "object" || !isId(id)) return null;
  const name = typeof t.name === "string" ? safeLine(t.name).slice(0, TEMPLATE_NAME_MAX) : "";
  if (!name || !Array.isArray(t.items)) return null;
  const items: TemplateItem[] = [];
  for (const [n, item] of t.items.slice(0, QUOTE_ITEMS_MAX).entries()) {
    const it = cleanQuoteItem(item, `t${n}`);
    if (it) items.push({ kind: it.kind, name: it.name, qty: it.qty, unit: it.unit, price: it.price });
  }
  if (items.length === 0) return null;
  const createdAt = typeof t.createdAt === "number" && Number.isFinite(t.createdAt) && t.createdAt > 0 ? t.createdAt : 1;
  const margin = cleanMargin(t.margin);
  return { id, name, items, ...(margin !== undefined ? { margin } : {}), createdAt };
}

/** Migawka wyceny jako szablon: pozycje w kolejności wyceny, z marżą. `null` = wycena bez pozycji albo pusta nazwa. */
export function templateFromJob(job: Pick<Job, "items" | "margin">, name: string, id: string, now: number): QuoteTemplate | null {
  const ordered = [...job.items].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const items = ordered.map(({ kind, name: n, qty, unit, price }) => ({ kind, name: n, qty, unit, price }));
  return cleanTemplate({ name, margin: job.margin, createdAt: now, items }, id);
}

export interface TemplatePlan {
  /** Pozycje do dopisania, z nowymi id i kolejnością za istniejącymi. */
  items: QuoteItem[];
  /** Pozycje pominięte, bo wycena osiągnęłaby limit. */
  skipped: number;
  /** Marża do ustawienia w wycenie (tylko gdy wycena nie ma własnej). */
  margin?: number;
}

/** Plan wstawienia szablonu do wyceny: dopisuje pozycje za istniejącymi, w limicie `QUOTE_ITEMS_MAX`. */
export function planInsert(template: QuoteTemplate, job: Pick<Job, "items" | "margin">, newId: () => string): TemplatePlan {
  const room = Math.max(0, QUOTE_ITEMS_MAX - job.items.length);
  let order = job.items.reduce((m, i) => Math.max(m, i.order + 1), 0);
  const items = template.items.slice(0, room).map((i) => ({ ...i, id: newId(), order: order++ }));
  return {
    items,
    skipped: template.items.length - items.length,
    ...(template.margin !== undefined && job.margin === undefined ? { margin: template.margin } : {}),
  };
}
