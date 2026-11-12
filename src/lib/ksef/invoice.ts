import { isValidNip, normalizeNip } from "./nip";

/**
 * Model faktury VAT (KSeF Etap 1, ADR-6) i obliczenia w groszach. Kwoty są liczbami całkowitymi (grosze), nigdy
 * `float`: sumy muszą się zgadzać co do grosza z tym, co trafi do XML FA(3). Ilości mają do 6 miejsc po przecinku
 * jak w schemacie (zapisane jako `qty` w tysięcznych: 1,5 szt. = 1500), ceny jednostkowe w groszach.
 */

/** Stawki obsługiwane w Etapie 1 (czynny podatnik, usługi dla klientów krajowych). `0` = „0 KR” (0% krajowa). */
export const VAT_RATES = [23, 8, 5, 0] as const;
export type VatRate = (typeof VAT_RATES)[number];

export type PriceMode = "net" | "gross";

export interface InvoiceLine {
  name: string;
  /** Jednostka miary, np. „szt.”, „godz.”, „kpl.”. */
  unit: string;
  /** Ilość w tysięcznych (1,5 → 1500). */
  qtyMilli: number;
  /** Cena jednostkowa w groszach — netto albo brutto, zależnie od `Invoice.priceMode`. */
  unitPrice: number;
  rate: VatRate;
}

export interface Party {
  name: string;
  /** NIP bez kresek; pusty u nabywcy konsumenta. */
  nip: string;
  /** Adres w jednym lub dwóch wierszach. */
  address1: string;
  address2?: string;
}

export interface InvoicePayment {
  /** Termin płatności „RRRR-MM-DD”. */
  dueDate?: string;
  /** 1 gotówka, 2 karta, 6 przelew, 7 mobilna. */
  form: 1 | 2 | 6 | 7;
  /** Numer rachunku do przelewu (tylko cyfry i znaki, 10–34). */
  account?: string;
}

/**
 * Dane faktury korygującej (RodzajFaktury = KOR). `Invoice.lines` to wtedy stan PO korekcie, a `linesBefore` — stan
 * przed (tak jak na fakturze korygowanej). Sumy na korekcie to różnice „po − przed”, więc mogą być ujemne.
 */
export interface InvoiceCorrection {
  /** Faktura korygowana: numer i data wystawienia (P_2 i P_1 oryginału). */
  originalNumber: string;
  originalIssueDate: string;
  /** Numer KSeF faktury korygowanej, jeśli została wgrana (puste = „poza KSeF”). */
  ksefNumber?: string;
  /** Przyczyna korekty (PrzyczynaKorekty). */
  reason: string;
  /** 1 = skutek w dacie ujęcia faktury pierwotnej (np. błąd), 2 = w dacie wystawienia korekty (np. rabat po sprzedaży). */
  type: 1 | 2;
  linesBefore: InvoiceLine[];
}

export interface Invoice {
  /** Numer faktury nadany przy wystawieniu (P_2), np. „FV/A/2026/11/001”. */
  number: string;
  /** Data wystawienia i data dostawy/wykonania usługi „RRRR-MM-DD”. */
  issueDate: string;
  saleDate: string;
  seller: Party;
  buyer: Party;
  priceMode: PriceMode;
  lines: InvoiceLine[];
  payment?: InvoicePayment;
  /** Tylko faktura korygująca. */
  correction?: InvoiceCorrection;
}

export interface RateTotals {
  rate: VatRate;
  net: number;
  vat: number;
  gross: number;
}

export interface LineAmounts {
  /** Wartość netto i brutto pozycji (grosze). */
  net: number;
  gross: number;
}

export interface InvoiceTotals {
  byRate: RateTotals[];
  net: number;
  vat: number;
  gross: number;
  lines: LineAmounts[];
}

/** Zaokrąglenie do grosza „half away from zero” — jak w obliczeniach podatkowych (nie bankowe). */
export const roundHalfUp = (n: number): number => Math.sign(n) * Math.round(Math.abs(n) + Number.EPSILON);

const rateFactor = (rate: VatRate) => 1 + rate / 100;

/**
 * Sumy faktury. Pozycje: wartość = ilość × cena (zaokrąglona do grosza). Sumy per stawka:
 * - ceny netto: netto = Σ pozycji, VAT = netto × stawka (zaokrąglony raz na stawkę),
 * - ceny brutto: brutto = Σ pozycji, netto = brutto / (1 + stawka), VAT = brutto − netto.
 * Dzięki temu wartość brutto z cennika (np. 1 230 zł) pozostaje dokładnie taka na fakturze.
 */
export function computeLines(inv: Pick<Invoice, "lines" | "priceMode">): InvoiceTotals {
  const lines: LineAmounts[] = inv.lines.map((l) => {
    const value = roundHalfUp((l.qtyMilli * l.unitPrice) / 1000);
    return inv.priceMode === "net"
      ? { net: value, gross: roundHalfUp(value * rateFactor(l.rate)) }
      : { net: roundHalfUp(value / rateFactor(l.rate)), gross: value };
  });
  const byRate: RateTotals[] = [];
  for (const rate of VAT_RATES) {
    const idx = inv.lines.flatMap((l, i) => (l.rate === rate ? [i] : []));
    if (idx.length === 0) continue;
    if (inv.priceMode === "net") {
      const net = idx.reduce((s, i) => s + lines[i].net, 0);
      const vat = roundHalfUp(net * (rate / 100));
      byRate.push({ rate, net, vat, gross: net + vat });
    } else {
      const gross = idx.reduce((s, i) => s + lines[i].gross, 0);
      const net = roundHalfUp(gross / rateFactor(rate));
      byRate.push({ rate, net, vat: gross - net, gross });
    }
  }
  return {
    byRate, lines,
    net: byRate.reduce((s, r) => s + r.net, 0),
    vat: byRate.reduce((s, r) => s + r.vat, 0),
    gross: byRate.reduce((s, r) => s + r.gross, 0),
  };
}

/**
 * Sumy faktury do wyświetlenia i XML. Zwykła faktura: `computeLines`. Korekta: sumy per stawka to różnica „po − przed”
 * (wszystkie stawki z obu stanów), a `lines` opisują pozycje po korekcie.
 */
export function computeInvoice(inv: Pick<Invoice, "lines" | "priceMode" | "correction">): InvoiceTotals {
  const after = computeLines(inv);
  if (!inv.correction) return after;
  const before = computeLines({ lines: inv.correction.linesBefore, priceMode: inv.priceMode });
  const byRate: RateTotals[] = [];
  for (const rate of VAT_RATES) {
    const a = after.byRate.find((r) => r.rate === rate);
    const b = before.byRate.find((r) => r.rate === rate);
    if (!a && !b) continue;
    byRate.push({ rate, net: (a?.net ?? 0) - (b?.net ?? 0), vat: (a?.vat ?? 0) - (b?.vat ?? 0), gross: (a?.gross ?? 0) - (b?.gross ?? 0) });
  }
  return {
    byRate, lines: after.lines,
    net: after.net - before.net, vat: after.vat - before.vat, gross: after.gross - before.gross,
  };
}

/** Grosze → „1234.50” (kropka, dwa miejsca) do XML. */
export const toDecimal = (grosze: number): string => {
  const sign = grosze < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(grosze));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
};

/** Tysięczne → „1.5” (bez zbędnych zer), do 6 miejsc jak w schemacie. */
export const qtyToDecimal = (milli: number): string => {
  const abs = Math.abs(milli);
  const whole = Math.floor(abs / 1000);
  const frac = String(abs % 1000).padStart(3, "0").replace(/0+$/, "");
  return `${milli < 0 ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
};

/** Cena jednostkowa w groszach → „12.5” albo „12.50” (do 8 miejsc w schemacie; tu zawsze do 2). */
export const unitPriceToDecimal = (grosze: number): string => toDecimal(grosze);

// ── walidacja przed wystawieniem ─────────────────────────────────────────────────────────────

export const INVOICE_LINES_MAX = 200;
export const LINE_NAME_MAX = 256;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const validDate = (s: string) => DATE_RE.test(s) && !Number.isNaN(new Date(`${s}T12:00:00Z`).getTime()) && s >= "2025-09-01" && s <= "2049-12-31";

export interface InvoiceProblem {
  field: string;
  message: string;
}

const KSEF_NUMBER_RE = /^([1-9]((\d[1-9])|([1-9]\d))\d{7}|M\d{9}|[A-Z]{3}\d{7})-(20[2-9][0-9]|2[1-9][0-9]{2}|[3-9][0-9]{3})(0[1-9]|1[0-2])(0[1-9]|[1-2][0-9]|3[0-1])-([0-9A-F]{6})-?([0-9A-F]{6})-([0-9A-F]{2})$/;

function checkLines(list: InvoiceLine[], prefix: string, add: (field: string, message: string) => void): void {
  if (list.length > INVOICE_LINES_MAX) add("lines", `Najwyżej ${INVOICE_LINES_MAX} pozycji.`);
  list.forEach((l, i) => {
    const at = `${prefix}pozycja ${i + 1}`.replace(/^./, (ch) => ch.toUpperCase());
    if (!l.name.trim() || l.name.length > LINE_NAME_MAX) add(`lines.${i}.name`, `${at}: nazwa (do ${LINE_NAME_MAX} znaków).`);
    if (!l.unit.trim()) add(`lines.${i}.unit`, `${at}: jednostka.`);
    if (!Number.isInteger(l.qtyMilli) || l.qtyMilli <= 0 || l.qtyMilli > 1e12) add(`lines.${i}.qty`, `${at}: ilość większa od zera.`);
    if (!Number.isInteger(l.unitPrice) || l.unitPrice < 0 || l.unitPrice > 1e13) add(`lines.${i}.price`, `${at}: cena nieujemna.`);
    if (!VAT_RATES.includes(l.rate)) add(`lines.${i}.rate`, `${at}: nieobsługiwana stawka VAT.`);
  });
}

/** Lista problemów blokujących wystawienie; pusta = faktura jest poprawna formalnie. */
export function validateInvoice(inv: Invoice): InvoiceProblem[] {
  const p: InvoiceProblem[] = [];
  const add = (field: string, message: string) => p.push({ field, message });
  if (!inv.number.trim() || inv.number.length > 256) add("number", "Podaj numer faktury (do 256 znaków).");
  if (!validDate(inv.issueDate)) add("issueDate", "Data wystawienia: RRRR-MM-DD, od 2025-09-01.");
  if (!validDate(inv.saleDate)) add("saleDate", "Data wykonania usługi: RRRR-MM-DD.");
  if (!inv.seller.name.trim()) add("seller.name", "Podaj nazwę sprzedawcy.");
  if (!isValidNip(inv.seller.nip)) add("seller.nip", "NIP sprzedawcy jest niepoprawny (10 cyfr, suma kontrolna).");
  if (!inv.seller.address1.trim()) add("seller.address", "Podaj adres sprzedawcy.");
  if (!inv.buyer.name.trim()) add("buyer.name", "Podaj nazwę nabywcy.");
  if (inv.buyer.nip.trim() && !isValidNip(inv.buyer.nip)) add("buyer.nip", "NIP nabywcy jest niepoprawny. Zostaw puste dla konsumenta.");
  const c = inv.correction;
  if (inv.lines.length === 0 && !c) add("lines", "Dodaj co najmniej jedną pozycję.");
  checkLines(inv.lines, "", add);
  if (c) {
    if (!c.originalNumber.trim() || c.originalNumber.length > 256) add("correction.number", "Podaj numer faktury korygowanej.");
    if (!validDate(c.originalIssueDate)) add("correction.date", "Data faktury korygowanej: RRRR-MM-DD.");
    if (c.ksefNumber && !KSEF_NUMBER_RE.test(c.ksefNumber)) add("correction.ksef", "Numer KSeF faktury korygowanej jest niepoprawny.");
    if (!c.reason.trim() || c.reason.length > 256) add("correction.reason", "Podaj przyczynę korekty (do 256 znaków).");
    if (c.type !== 1 && c.type !== 2) add("correction.type", "Nieznany typ korekty.");
    if (c.linesBefore.length === 0) add("correction.lines", "Brak pozycji faktury korygowanej.");
    checkLines(c.linesBefore, "Przed korektą, ", add);
  }
  if (inv.payment?.form === 6 && inv.payment.account) {
    const acc = inv.payment.account.replace(/\s/g, "");
    if (acc.length < 10 || acc.length > 34) add("payment.account", "Numer rachunku: 10–34 znaki.");
  }
  if (p.length === 0 && computeInvoice(inv).gross > 1e13) add("lines", "Kwota faktury jest zbyt duża.");
  return p;
}

/** Dane sprzedawcy do formularza: NIP w postaci znormalizowanej. */
export const cleanSeller = (s: Party): Party => ({ ...s, nip: normalizeNip(s.nip) });
