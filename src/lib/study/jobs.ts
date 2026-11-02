import { cleanAmount } from "./billing";

/**
 * Zlecenia własne — fuchy (H3.4, plan 2026-10-29). Fucha to zwykła karta budowy (wpisy, zdjęcia,
 * materiał, godziny) z wpisem w osobnej mapie Yjs `studyJobs` (`yJobs.ts`): status, zakres prac,
 * termin i wycena. Rodzaj karty nie siedzi w `SiteCard`, bo starsza wersja przepisuje kartę przez
 * `cleanSite` i zgubiłaby nieznane pole — fucha stałaby się budową szefa. Pieniądze zostają poza
 * kartą (zasada 4 planu). Faktur nie ma (decyzja H-3): wycena i potwierdzenie wykonania w PDF.
 */

export const JOB_STATUSES = ["quote", "booked", "done", "paid"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export const JOB_STATUS_LABEL: Readonly<Record<JobStatus, string>> = { quote: "Wycena", booked: "Umówione", done: "Zrobione", paid: "Zapłacone" };

export const QUOTE_KINDS = ["labor", "material"] as const;
export type QuoteKind = (typeof QUOTE_KINDS)[number];
export const QUOTE_KIND_LABEL: Readonly<Record<QuoteKind, string>> = { labor: "Robocizna", material: "Materiał" };
const DEFAULT_UNIT: Readonly<Record<QuoteKind, string>> = { labor: "usł.", material: "szt." };

export const JOB_SCOPE_MAX = 500;
export const QUOTE_NAME_MAX = 80;
export const QUOTE_UNIT_MAX = 8;
export const QUOTE_ITEMS_MAX = 60;
export const QTY_MAX = 100_000;
export const MARGIN_MAX = 300;

export interface JobMeta {
  status: JobStatus;
  /** Kiedy ustawiono obecny status (ms). */
  statusAt: number;
  /** Co zrobić: „Wymiana baterii w kuchni, przeciek pod zlewem”. */
  scope?: string;
  /** Umówiony termin, czas lokalny „2026-11-05T14:00” (pokazywany w Kalendarzu). */
  term?: string;
  /** Marża na materiał w procentach (0–300); brak = 0. */
  margin?: number;
  created: number;
}

export interface QuoteItem {
  id: string;
  kind: QuoteKind;
  name: string;
  qty: number;
  unit: string;
  /** Cena jednostkowa (zł). */
  price: number;
  order: number;
}

export interface Job extends JobMeta {
  /** Pozycje wyceny w kolejności `order`. */
  items: QuoteItem[];
}

const isStatus = (v: unknown): v is JobStatus => typeof v === "string" && (JOB_STATUSES as readonly string[]).includes(v);
// Znaki sterujące są tu celem usunięcia (tekst trafia do PDF dla klienta).
// eslint-disable-next-line no-control-regex
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
const time = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined);
const TERM_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Ilość: dodatnia, do dwóch miejsc po przecinku. */
export function cleanQty(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 && v <= QTY_MAX ? Math.round(v * 100) / 100 : undefined;
}

/** Marża w procentach; 0 i brak to to samo (`undefined`). */
export function cleanMargin(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 && v <= MARGIN_MAX ? Math.round(v * 10) / 10 : undefined;
}

/** Wpis zlecenia z dokumentu (także obcy, z kopii) → czysty albo `null`. */
export function cleanJobMeta(raw: unknown): JobMeta | null {
  const j = raw as Partial<JobMeta> | null;
  if (!j || typeof j !== "object" || !isStatus(j.status)) return null;
  const created = time(j.created);
  if (created === undefined) return null;
  const scope = text(j.scope, JOB_SCOPE_MAX);
  const term = typeof j.term === "string" && TERM_RE.test(j.term) ? j.term : undefined;
  const margin = cleanMargin(j.margin);
  return {
    status: j.status,
    statusAt: time(j.statusAt) ?? created,
    ...(scope ? { scope } : {}),
    ...(term ? { term } : {}),
    ...(margin !== undefined ? { margin } : {}),
    created,
  };
}

/** Pozycja wyceny → czysta albo `null` (bez nazwy, ilości albo ceny). Cena 0 zł jest dozwolona („gratis”). */
export function cleanQuoteItem(raw: unknown, id: string): QuoteItem | null {
  const q = raw as Partial<QuoteItem> | null;
  if (!q || typeof q !== "object") return null;
  const kind: QuoteKind = q.kind === "material" ? "material" : "labor";
  const name = text(q.name, QUOTE_NAME_MAX);
  const qty = cleanQty(q.qty);
  const price = q.price === 0 ? 0 : cleanAmount(q.price);
  if (!name || qty === undefined || price === undefined) return null;
  const order = typeof q.order === "number" && Number.isFinite(q.order) ? q.order : 0;
  return { id, kind, name, qty, unit: text(q.unit, QUOTE_UNIT_MAX) || DEFAULT_UNIT[kind], price, order };
}

const grosze = (n: number) => Math.round(n * 100) / 100;

export interface QuoteTotals {
  labor: number;
  /** Materiał w cenach zakupu. */
  material: number;
  /** Marża doliczona do materiału (zł). */
  marginAmount: number;
  total: number;
}

/** Sumy wyceny; marża tylko na materiał. `total` to suma kwot pozycji dla klienta — ta sama co w PDF. */
export function quoteTotals(job: Pick<Job, "items" | "margin">): QuoteTotals {
  let labor = 0;
  let material = 0;
  let client = 0;
  for (const i of job.items) {
    if (i.kind === "labor") labor += i.qty * i.price;
    else material += i.qty * i.price;
    client += itemClientTotal(i, job.margin);
  }
  labor = grosze(labor);
  material = grosze(material);
  const total = grosze(client);
  return { labor, material, marginAmount: grosze(total - labor - material), total };
}

/** Kwota pozycji dla klienta (z marżą przy materiale) — w PDF klient nie widzi marży osobno. */
export function itemClientTotal(item: QuoteItem, margin: number | undefined): number {
  const base = item.qty * item.price;
  return grosze(item.kind === "material" ? base * (1 + (margin ?? 0) / 100) : base);
}

/** Cena jednostkowa dla klienta (z marżą przy materiale). */
export function itemClientPrice(item: QuoteItem, margin: number | undefined): number {
  return grosze(item.kind === "material" ? item.price * (1 + (margin ?? 0) / 100) : item.price);
}

/** „Niezapłacone”: suma wycen zleceń zrobionych, a jeszcze niezapłaconych. */
export function unpaidTotal(jobs: Iterable<Job>): number {
  let sum = 0;
  for (const j of jobs) if (j.status === "done") sum += quoteTotals(j).total;
  return grosze(sum);
}

/** Kolejność listy „Zlecenia”: najpierw do zrobienia (umówione po terminie), potem wyceny, zrobione, zapłacone. */
const STATUS_RANK: Readonly<Record<JobStatus, number>> = { booked: 0, quote: 1, done: 2, paid: 3 };
export function sortJobs<T extends Pick<Job, "status" | "term" | "statusAt">>(list: T[]): T[] {
  return [...list].sort((a, b) =>
    STATUS_RANK[a.status] - STATUS_RANK[b.status]
    || (a.status === "booked" ? (a.term ?? "9").localeCompare(b.term ?? "9") : b.statusAt - a.statusAt));
}

/** Ilość w polu: „2,5” → 2.5; pusty albo zły tekst → `undefined`. */
export function parseQty(raw: string): number | undefined {
  const t = raw.replace(/\s/g, "").replace(",", ".");
  return /^\d+(\.\d{0,2})?$/.test(t) ? cleanQty(Number(t)) : undefined;
}

/** Marża w polu: „15” albo „12,5”; pusty tekst → `null` (bez marży), zły → `undefined`. */
export function parseMargin(raw: string): number | null | undefined {
  const t = raw.replace(/\s/g, "").replace(/%$/, "").replace(",", ".");
  if (t === "" || t === "0") return null;
  return /^\d+(\.\d)?$/.test(t) ? cleanMargin(Number(t)) : undefined;
}

/** „5 lis, 14:00” — termin do pokazania. */
export function termLabel(term: string): string {
  const d = new Date(term);
  if (Number.isNaN(d.getTime())) return term;
  return `${d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}, ${term.slice(11)}`;
}
