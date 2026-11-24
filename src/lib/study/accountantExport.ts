import { computeInvoice } from "@/lib/ksef/invoice";
import { invoiceFileName } from "@/lib/ksef/fa3";
import type { InvoiceRecord } from "@/lib/ksef/yInvoices";
import { cell } from "@/lib/shifts/timesheet";
import { passwordStrength } from "@/lib/vault";
import { exportMileageCSV, monthEntries, type MileageEntry } from "./mileage";

/**
 * R3.5 „Dla księgowej”: jeden ZIP za miesiąc — faktury (XML FA(3) i PDF), rejestr faktur CSV i kilometrówka CSV.
 * ZIP jest szyfrowany standardem WinZip AES-256 (otwiera go 7-Zip, WinRAR i inne), bo faktury mają dane nabywców;
 * hasło właściciel przekazuje księgowej osobno. Biblioteka `@zip.js/zip.js` ładuje się dopiero przy eksporcie.
 */

export interface AccountantInput {
  /** „2026-11”. */
  monthKey: string;
  invoices: readonly InvoiceRecord[];
  mileage: readonly MileageEntry[];
  siteName: (id: string) => string;
}

interface TextFile { name: string; text: string }

const zl = (grosze: number) => (grosze / 100).toFixed(2).replace(".", ",");
const csv = (rows: readonly (readonly (string | number)[])[]) => "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";

/** „RRRR-MM” z poprawnym miesiącem. */
export const isMonthKey = (key: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(key);

/** Nazwa pliku faktury bez powtórzeń: różne numery mogą dać tę samą nazwę („FV/1” i „FV-1”) — wtedy „-2”, „-3”… */
function uniqueNames(list: readonly InvoiceRecord[]): Map<string, string> {
  const used = new Set<string>();
  const out = new Map<string, string>();
  for (const r of list) {
    const base = invoiceFileName(r.number).replace(/\.xml$/, "");
    let name = base;
    for (let n = 2; used.has(name); n++) name = `${base}-${n}`;
    used.add(name);
    out.set(r.id, name);
  }
  return out;
}

/** Faktury z datą wystawienia w miesiącu, od najstarszej. */
export function monthInvoices(invoices: readonly InvoiceRecord[], monthKey: string): InvoiceRecord[] {
  return invoices
    .filter((r) => r.invoice.issueDate.startsWith(`${monthKey}-`))
    .sort((a, b) => a.invoice.issueDate.localeCompare(b.invoice.issueDate) || a.issuedAt - b.issuedAt);
}

export interface AccountantPlan {
  invoices: InvoiceRecord[];
  trips: MileageEntry[];
  /** Pliki tekstowe paczki (rejestr, XML, kilometrówka); PDF-y powstają w `buildAccountantZip`. */
  texts: TextFile[];
  /** Nazwa pliku (bez rozszerzenia) dla faktury po id — ta sama dla XML i PDF. */
  names: Map<string, string>;
}

/** Co wejdzie do paczki za miesiąc — to samo liczy okno (liczniki) i ZIP. Zły albo pusty miesiąc = `null`. */
export function accountantPlan({ monthKey, invoices, mileage, siteName }: AccountantInput): AccountantPlan | null {
  if (!isMonthKey(monthKey)) return null;
  const list = monthInvoices(invoices, monthKey);
  const [y, m] = monthKey.split("-").map(Number);
  const trips = monthEntries(mileage, y, m);
  if (list.length === 0 && trips.length === 0) return null;
  const names = uniqueNames(list);
  const register: (string | number)[][] = [["Numer", "Data wystawienia", "Data sprzedaży", "Nabywca", "NIP nabywcy", "Netto (zł)", "VAT (zł)", "Brutto (zł)", "Korekta"]];
  const xml: TextFile[] = [];
  let net = 0, vat = 0, gross = 0;
  for (const r of list) {
    const t = computeInvoice(r.invoice);
    net += t.net; vat += t.vat; gross += t.gross;
    register.push([r.number, r.invoice.issueDate, r.invoice.saleDate, r.invoice.buyer.name, r.invoice.buyer.nip, zl(t.net), zl(t.vat), zl(t.gross), r.invoice.correction ? "tak" : ""]);
    xml.push({ name: `faktury/${names.get(r.id)}.xml`, text: r.xml });
  }
  register.push([]);
  register.push(["Razem", "", "", `${list.length}`, "", zl(net), zl(vat), zl(gross), ""]);
  const texts = [{ name: `rejestr-faktur-${monthKey}.csv`, text: csv(register) }, ...xml];
  if (trips.length > 0) texts.push({ name: `kilometrowka-${monthKey}.csv`, text: exportMileageCSV({ year: y, month: m, entries: trips }, siteName) });
  return { invoices: list, trips, texts, names };
}

export const accountantZipName = (monthKey: string) => `ksiegowa-${monthKey}.zip`;

/**
 * Czy hasło nadaje się do paczki. Format WinZip AES wyprowadza klucz PBKDF2-SHA1 z 1000 iteracji (wymóg formatu),
 * więc łamanie offline jest tanie — wymagamy co najmniej „Dobre” (14+ znaków, 3 rodzaje), nie tylko „Średnie”.
 */
export const accountantPasswordOk = (password: string) => passwordStrength(password).score >= 3;

/** Zaszyfrowany ZIP (bajty) z planu. `pdf` zwraca bajty PDF faktury (w aplikacji z `buildInvoicePdf`, w testach atrapa). */
export async function buildAccountantZip(plan: AccountantPlan, password: string, pdf: (r: InvoiceRecord) => Promise<Uint8Array>): Promise<Uint8Array> {
  if (!accountantPasswordOk(password)) throw new Error("weak-password");
  const { ZipWriter, Uint8ArrayWriter, Uint8ArrayReader, configure } = await import("@zip.js/zip.js");
  // Bez Workerów: pliki są małe, a wątek w tle nic tu nie przyspiesza.
  configure({ useWebWorkers: false });
  const zip = new ZipWriter(new Uint8ArrayWriter(), { password, encryptionStrength: 3 });
  for (const f of plan.texts) await zip.add(f.name, new Uint8ArrayReader(new TextEncoder().encode(f.text)));
  for (const r of plan.invoices) await zip.add(`faktury/${plan.names.get(r.id)}.pdf`, new Uint8ArrayReader(await pdf(r)));
  return zip.close();
}
