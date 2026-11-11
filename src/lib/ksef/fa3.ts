import { computeInvoice, qtyToDecimal, toDecimal, type Invoice, type Party } from "./invoice";
import { normalizeNip } from "./nip";
import { escapeXml, tag } from "./xml";

/**
 * Generator XML faktury w schemacie FA(3) (KSeF, ADR-6) dla czynnego podatnika VAT wystawiającego zwykłą fakturę
 * (`RodzajFaktury` = VAT) klientowi krajowemu — firmie albo konsumentowi. Bez odwrotnego obciążenia, zaliczek, korekt
 * i walut obcych (kolejne etapy). XML składamy ręcznie z typowanych struktur (`xml.ts`), kolejność elementów jest
 * dokładnie taka jak w XSD `crd.gov.pl/wzor/2025/06/25/13775/`; zgodność sprawdza `scripts/ksef/ValidateFa3.java`.
 */

export const FA3_NAMESPACE = "http://crd.gov.pl/wzor/2025/06/25/13775/";

/** Nazwa systemu w nagłówku (pole SystemInfo). */
const SYSTEM_INFO = "Notatnik";

/** Moment wytworzenia w UTC bez ułamków sekundy: „2026-11-11T10:15:30Z”. */
export const utcStamp = (ms: number): string => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

function address(a: Party): string {
  return `<Adres>${tag("KodKraju", "PL")}${tag("AdresL1", a.address1)}${a.address2?.trim() ? tag("AdresL2", a.address2) : ""}</Adres>`;
}

function seller(p: Party): string {
  return `<Podmiot1><DaneIdentyfikacyjne>${tag("NIP", normalizeNip(p.nip))}${tag("Nazwa", p.name)}</DaneIdentyfikacyjne>${address(p)}</Podmiot1>`;
}

function buyer(p: Party): string {
  const nip = normalizeNip(p.nip);
  // Konsument bez NIP: `BrakID` zamiast numeru (schemat wymaga jednej z form identyfikacji).
  const id = nip ? tag("NIP", nip) : tag("BrakID", 1);
  const addr = p.address1.trim() ? address(p) : "";
  return `<Podmiot2><DaneIdentyfikacyjne>${id}${tag("Nazwa", p.name)}</DaneIdentyfikacyjne>${addr}${tag("JST", 2)}${tag("GV", 2)}</Podmiot2>`;
}

/** Pola P_13_x / P_14_x według stawki; 0% krajowa trafia do P_13_6_1 (bez kwoty podatku). */
function summaries(totals: ReturnType<typeof computeInvoice>): string {
  const field: Record<number, [string, string | null]> = { 23: ["P_13_1", "P_14_1"], 8: ["P_13_2", "P_14_2"], 5: ["P_13_3", "P_14_3"], 0: ["P_13_6_1", null] };
  // Kolejność jak w XSD: 23 → 8 → 5 → 0%.
  return totals.byRate
    .map((r) => {
      const [net, vat] = field[r.rate];
      return tag(net, toDecimal(r.net)) + (vat ? tag(vat, toDecimal(r.vat)) : "");
    })
    .join("");
}

const rateLabel = (rate: number): string => (rate === 0 ? "0 KR" : String(rate));

function lines(inv: Invoice, totals: ReturnType<typeof computeInvoice>): string {
  return inv.lines
    .map((l, i) => {
      const a = totals.lines[i];
      const price = inv.priceMode === "net" ? tag("P_9A", toDecimal(l.unitPrice)) : tag("P_9B", toDecimal(l.unitPrice));
      const value = inv.priceMode === "net" ? tag("P_11", toDecimal(a.net)) : tag("P_11A", toDecimal(a.gross));
      return `<FaWiersz>${tag("NrWierszaFa", i + 1)}${tag("P_7", l.name)}${tag("P_8A", l.unit)}${tag("P_8B", qtyToDecimal(l.qtyMilli))}${price}${value}${tag("P_12", rateLabel(l.rate))}</FaWiersz>`;
    })
    .join("");
}

function payment(inv: Invoice): string {
  const p = inv.payment;
  if (!p) return "";
  const due = p.dueDate ? `<TerminPlatnosci>${tag("Termin", p.dueDate)}</TerminPlatnosci>` : "";
  const account = p.form === 6 && p.account?.replace(/\s/g, "") ? `<RachunekBankowy>${tag("NrRB", p.account.replace(/\s/g, ""))}</RachunekBankowy>` : "";
  return `<Platnosc>${due}${tag("FormaPlatnosci", p.form)}${account}</Platnosc>`;
}

/** Adnotacje obowiązkowe: zwykła faktura bez żadnej z procedur szczególnych. */
const ADNOTACJE = "<Adnotacje>" + tag("P_16", 2) + tag("P_17", 2) + tag("P_18", 2) + tag("P_18A", 2)
  + `<Zwolnienie>${tag("P_19N", 1)}</Zwolnienie>`
  + `<NoweSrodkiTransportu>${tag("P_22N", 1)}</NoweSrodkiTransportu>`
  + tag("P_23", 2)
  + `<PMarzy>${tag("P_PMarzyN", 1)}</PMarzy>`
  + "</Adnotacje>";

/**
 * XML FA(3) z gotowej faktury. Wywołujący sprawdza wcześniej `validateInvoice`; tu nie rzucamy na błędach formalnych,
 * tylko składamy dokument z tego, co dostał. `createdAt` (ms) to chwila wytworzenia pliku.
 */
export function buildFa3Xml(inv: Invoice, createdAt: number): string {
  const totals = computeInvoice(inv);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<Faktura xmlns="${FA3_NAMESPACE}">`,
    `<Naglowek><KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>${tag("WariantFormularza", 3)}${tag("DataWytworzeniaFa", utcStamp(createdAt))}${tag("SystemInfo", SYSTEM_INFO)}</Naglowek>`,
    seller(inv.seller),
    buyer(inv.buyer),
    "<Fa>",
    tag("KodWaluty", "PLN"), tag("P_1", inv.issueDate), tag("P_2", inv.number), tag("P_6", inv.saleDate),
    summaries(totals),
    tag("P_15", toDecimal(totals.gross)),
    ADNOTACJE,
    tag("RodzajFaktury", "VAT"),
    lines(inv, totals),
    payment(inv),
    "</Fa>",
    "</Faktura>",
  ].join("");
}

/** Nazwa pliku XML: bez znaków ze ścieżek i bez NIP (RODO), np. „FV-A-2026-11-001.xml”. */
export const invoiceFileName = (number: string): string => `${escapeXml(number).replace(/&[a-z]+;/g, "").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "faktura"}.xml`;
