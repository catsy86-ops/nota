import * as Y from "yjs";
import { computeInvoice, validateInvoice, type Invoice } from "./invoice";

/**
 * Wystawione faktury w Y.Doc (ADR-6). Mapa `studyInvoices`: id faktury → niezmienny rekord. Rekord po zapisie nie jest
 * edytowany ani nadpisywany (korekta to osobna faktura, Etap 3); `add` odmawia istniejącego id. Źródłem prawdy jest
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
}

const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;
const isStr = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const isParty = (p: unknown): boolean => !!p && typeof p === "object" && isStr((p as { name?: unknown }).name, 600) && isStr((p as { nip?: unknown }).nip, 40) && isStr((p as { address1?: unknown }).address1, 600);

/** Rekord z dowolnego wejścia (Yjs, kopia, peer) albo `null`. Nie ufamy niczemu, w tym polu `hash`. */
export function cleanRecord(raw: unknown): InvoiceRecord | null {
  const r = raw as Partial<InvoiceRecord> | null;
  if (!r || typeof r !== "object" || !isId(r.id) || !isStr(r.number, 256) || !r.number) return null;
  if (typeof r.issuedAt !== "number" || !Number.isFinite(r.issuedAt) || r.issuedAt <= 0) return null;
  if (!isId(r.siteId) || !isStr(r.xml, XML_MAX_CHARS) || !r.xml || typeof r.hash !== "string" || !/^[0-9a-f]{64}$/.test(r.hash)) return null;
  const inv = r.invoice as Invoice | undefined;
  if (!inv || typeof inv !== "object" || !isParty(inv.seller) || !isParty(inv.buyer) || !Array.isArray(inv.lines) || inv.lines.length > 200) return null;
  if (validateInvoice(inv).length > 0) return null;
  return { id: r.id, number: r.number, issuedAt: r.issuedAt, siteId: r.siteId, invoice: inv, xml: r.xml, hash: r.hash, ...(typeof r.device === "string" ? { device: r.device.slice(0, 6) } : {}) };
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

export interface InvoicesDump {
  invoices: InvoiceRecord[];
}

export function createYInvoices(doc: Y.Doc) {
  const map = doc.getMap<unknown>("studyInvoices");
  let snapshot: InvoiceRecord[] | null = null;
  const listeners = new Set<() => void>();
  map.observe(() => {
    snapshot = null;
    listeners.forEach((l) => l());
  });

  /** Wszystkie faktury od najnowszej; ten sam obiekt do następnej zmiany. */
  function all(): InvoiceRecord[] {
    if (snapshot) return snapshot;
    const out: InvoiceRecord[] = [];
    for (const [k, v] of map.entries()) {
      const rec = cleanRecord(v);
      if (rec && rec.id === k) out.push(rec);
    }
    out.sort((a, b) => b.issuedAt - a.issuedAt || b.number.localeCompare(a.number));
    snapshot = out;
    return out;
  }

  const get = (id: string): InvoiceRecord | undefined => all().find((r) => r.id === id);

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  /** Dopisuje fakturę. `false` = zły rekord, istniejące id (niezmienność) albo limit. */
  function add(record: InvoiceRecord): boolean {
    const clean = cleanRecord(record);
    if (!clean || map.has(clean.id) || map.size >= INVOICES_MAX) return false;
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

  return { all, get, subscribe, add, dump, mergeDump };
}

/** Suma brutto faktury w groszach (do list). */
export const recordGross = (r: InvoiceRecord): number => computeInvoice(r.invoice).gross;
