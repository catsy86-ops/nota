import * as Y from "yjs";
import { computeInvoice, validateInvoice, VAT_RATES, type Invoice, type InvoiceCorrection, type InvoiceLine, type InvoicePayment, type Party, type VatRate } from "./invoice";

/**
 * Wystawione faktury w Y.Doc (ADR-6). Mapa `studyInvoices`: id faktury → niezmienny rekord. Rekord po zapisie nie jest
 * edytowany ani nadpisywany (korekta to osobna faktura z `invoice.correction`); `add` odmawia istniejącego id. Źródłem prawdy jest
 * zapisany XML i jego SHA-256 — przy odczycie zgodność skrótu sprawdza `verifyRecord`, niezgodność oznacza uszkodzenie
 * albo ręczną zmianę. Poświadczeń KSeF tu nie ma i nie będzie.
 */

export const INVOICES_ORIGIN = "invoices";
export const INVOICES_MAX = 5000;
export const XML_MAX_CHARS = 1_000_000;

export interface InvoiceRecord {
  id: string;
  number: string;
  /** Chwila wystawienia (ms). */
  issuedAt: number;
  /** Budowa (zlecenie), z którego powstała faktura. */
  siteId: string;
  /** Faktura jako dane (do wizualizacji PDF); XML jest źródłem prawdy. */
  invoice: Invoice;
  /** Zapisany XML FA(3) i jego SHA-256 (hex). */
  xml: string;
  hash: string;
  /** Seria urządzenia, które wystawiło fakturę. */
  device?: string;
  /** Losowy identyfikator urządzenia (wykrywanie tej samej serii na dwóch telefonach). */
  deviceId?: string;
}

const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;
const isStr = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);

function cleanParty(p: unknown): Party | null {
  if (!isObj(p) || !isStr(p.name, 600) || !isStr(p.nip, 40) || !isStr(p.address1, 600)) return null;
  if (p.address2 !== undefined && !isStr(p.address2, 600)) return null;
  return { name: p.name, nip: p.nip, address1: p.address1, ...(p.address2 !== undefined ? { address2: p.address2 } : {}) };
}

function cleanLines(v: unknown): InvoiceLine[] | null {
  if (!Array.isArray(v) || v.length > 200) return null;
  const out: InvoiceLine[] = [];
  for (const l of v) {
    if (!isObj(l) || !isStr(l.name, 600) || !isStr(l.unit, 100) || !isInt(l.qtyMilli) || !isInt(l.unitPrice)) return null;
    if (!(VAT_RATES as readonly unknown[]).includes(l.rate)) return null;
    out.push({ name: l.name, unit: l.unit, qtyMilli: l.qtyMilli, unitPrice: l.unitPrice, rate: l.rate as VatRate });
  }
  return out;
}

function cleanInvoice(inv: unknown, number: string): Invoice | null {
  if (!isObj(inv) || inv.number !== number) return null;
  if (!isStr(inv.issueDate, 10) || !isStr(inv.saleDate, 10) || (inv.priceMode !== "net" && inv.priceMode !== "gross")) return null;
  const seller = cleanParty(inv.seller);
  const buyer = cleanParty(inv.buyer);
  const lines = cleanLines(inv.lines);
  if (!seller || !buyer || !lines) return null;
  let payment: InvoicePayment | undefined;
  if (inv.payment !== undefined) {
    const p = inv.payment;
    if (!isObj(p) || ![1, 2, 6, 7].includes(p.form as number)) return null;
    if ((p.dueDate !== undefined && !isStr(p.dueDate, 10)) || (p.account !== undefined && !isStr(p.account, 64))) return null;
    payment = { form: p.form as InvoicePayment["form"], ...(p.dueDate !== undefined ? { dueDate: p.dueDate as string } : {}), ...(p.account !== undefined ? { account: p.account as string } : {}) };
  }
  let correction: InvoiceCorrection | undefined;
  if (inv.correction !== undefined) {
    const c = inv.correction;
    const before = isObj(c) ? cleanLines(c.linesBefore) : null;
    if (!isObj(c) || !before || !isStr(c.originalNumber, 256) || !isStr(c.originalIssueDate, 10) || !isStr(c.reason, 256)
      || (c.type !== 1 && c.type !== 2) || (c.ksefNumber !== undefined && !isStr(c.ksefNumber, 60))) return null;
    correction = { originalNumber: c.originalNumber, originalIssueDate: c.originalIssueDate, reason: c.reason, type: c.type, linesBefore: before, ...(c.ksefNumber !== undefined ? { ksefNumber: c.ksefNumber } : {}) };
  }
  return { number, issueDate: inv.issueDate, saleDate: inv.saleDate, seller, buyer, priceMode: inv.priceMode, lines, ...(payment ? { payment } : {}), ...(correction ? { correction } : {}) };
}

/**
 * Rekord z dowolnego wejścia (Yjs, kopia, peer) albo `null`. Nie ufamy niczemu, w tym polu `hash`. Tylko kontrola struktury i
 * typów — reguły biznesowe (`validateInvoice`) działają przed wystawieniem, nie przy odczycie: zaostrzenie reguł nie może
 * ukryć faktury już wystawionej. Nigdy nie rzuca.
 */
export function cleanRecord(raw: unknown): InvoiceRecord | null {
  try {
    if (!isObj(raw)) return null;
    const r = raw as Partial<InvoiceRecord>;
    if (!isId(r.id) || !isStr(r.number, 256) || !r.number) return null;
    if (typeof r.issuedAt !== "number" || !Number.isFinite(r.issuedAt) || r.issuedAt <= 0) return null;
    if (!isId(r.siteId) || !isStr(r.xml, XML_MAX_CHARS) || !r.xml || typeof r.hash !== "string" || !/^[0-9a-f]{64}$/.test(r.hash)) return null;
    const invoice = cleanInvoice(r.invoice, r.number);
    if (!invoice) return null;
    return { id: r.id, number: r.number, issuedAt: r.issuedAt, siteId: r.siteId, invoice, xml: r.xml, hash: r.hash, ...(typeof r.device === "string" ? { device: r.device.slice(0, 6) } : {}), ...(typeof r.deviceId === "string" ? { deviceId: r.deviceId.slice(0, 32) } : {}) };
  } catch {
    return null;
  }
}

/** SHA-256 napisu (UTF-8) w hex. */
export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Czy zapisany skrót zgadza się z XML-em (rekord nie został zmieniony po wystawieniu). */
export async function verifyRecord(r: InvoiceRecord): Promise<boolean> {
  return (await sha256Hex(r.xml)) === r.hash;
}

/** Klucz mapy, którego rekord jest nieczytelny, i numer, jeśli dało się go odczytać. */
export interface DamagedRecord {
  key: string;
  number?: string;
}

interface Snapshot {
  ok: InvoiceRecord[];
  damaged: DamagedRecord[];
}

export interface InvoicesDump {
  invoices: InvoiceRecord[];
}

export function createYInvoices(doc: Y.Doc) {
  const map = doc.getMap<unknown>("studyInvoices");
  let snapshot: Snapshot | null = null;
  const listeners = new Set<() => void>();
  map.observe(() => {
    snapshot = null;
    listeners.forEach((l) => l());
  });

  /** Odczyt całej mapy: poprawne faktury od najnowszej i klucze, których rekord nie przeszedł kontroli struktury. */
  function read(): Snapshot {
    if (snapshot) return snapshot;
    const ok: InvoiceRecord[] = [];
    const damaged: DamagedRecord[] = [];
    for (const [k, v] of map.entries()) {
      const rec = cleanRecord(v);
      if (rec && rec.id === k) ok.push(rec);
      else {
        const n = isObj(v) && typeof v.number === "string" && v.number ? v.number : undefined;
        damaged.push({ key: k, ...(n ? { number: n } : {}) });
      }
    }
    ok.sort((a, b) => b.issuedAt - a.issuedAt || b.number.localeCompare(a.number));
    snapshot = { ok, damaged };
    return snapshot;
  }

  /** Wszystkie poprawne faktury od najnowszej; ten sam obiekt do następnej zmiany. */
  const all = (): InvoiceRecord[] => read().ok;
  /** Rekordy, które nie przeszły kontroli struktury (nie znikają po cichu — widok może je pokazać). */
  const damaged = (): DamagedRecord[] => read().damaged;
  /** Numery ze WSZYSTKICH kluczy mapy, także uszkodzonych — źródło licznika numeracji. */
  const numbers = (): string[] => {
    const { ok, damaged: bad } = read();
    return [...ok.map((r) => r.number), ...bad.flatMap((d) => (d.number ? [d.number] : []))];
  };

  const get = (id: string): InvoiceRecord | undefined => all().find((r) => r.id === id);

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  /** Dopisuje fakturę. `false` = zły rekord, niespełnione reguły, istniejące id (niezmienność), zajęty numer albo limit. */
  function add(record: InvoiceRecord): boolean {
    const clean = cleanRecord(record);
    if (!clean || validateInvoice(clean.invoice).length > 0 || numbers().includes(clean.number) || map.has(clean.id) || map.size >= INVOICES_MAX) return false;
    doc.transact(() => map.set(clean.id, clean), INVOICES_ORIGIN);
    return true;
  }

  const dump = (): InvoicesDump => ({ invoices: all() });

  /** Scala kopię: tylko faktury, których tu nie ma; istniejące nigdy nie są nadpisywane. */
  function mergeDump(raw: unknown): void {
    const list = (raw as Partial<InvoicesDump> | null)?.invoices;
    if (!Array.isArray(list)) return;
    doc.transact(() => {
      for (const v of list.slice(0, INVOICES_MAX)) {
        const rec = cleanRecord(v);
        if (rec && !map.has(rec.id) && map.size < INVOICES_MAX) map.set(rec.id, rec);
      }
    }, INVOICES_ORIGIN);
  }

  return { all, damaged, numbers, get, subscribe, add, dump, mergeDump };
}

/** Suma brutto faktury w groszach (do list). */
export const recordGross = (r: InvoiceRecord): number => computeInvoice(r.invoice).gross;
