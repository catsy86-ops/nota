import { localDayKey } from "@/lib/dayDone";
import { addDaysKey, dayDiff } from "@/lib/shifts/pattern";
import { cleanAmount, round2 } from "./billing";
import { cleanNotes, QUOTE_NOTES_MAX } from "./quoteNotes";
import { cleanSeries } from "@/lib/ksef/numbering";
import { pluralPl } from "@/lib/plural";

/**
 * Wycena jako dokument dla klienta (plan wycen i klientów, Etap 3): numer, daty, VAT, rabat, uwagi i stan (wysłana,
 * przyjęta, odrzucona). Osobny klucz `q␁budowa` w mapie `studyJobs` (`yJobs.ts`), a nie pola `JobMeta` — starsza wersja
 * przepisuje wpis zlecenia przy każdej zmianie statusu i zgubiłaby nieznane pola. Stany wyceny to pola z datą, nie nowe
 * wartości `JOB_STATUSES` (starsza wersja odrzuca zlecenie z nieznanym statusem). Czyste funkcje, bez Yjs.
 */

export const QUOTE_VAT_MODES = ["net", "gross"] as const;
export type QuoteVatMode = (typeof QUOTE_VAT_MODES)[number];
export const QUOTE_VAT_RATES = [23, 8, 5, 0] as const;
export type QuoteVatRate = (typeof QUOTE_VAT_RATES)[number];
export const DEFAULT_VAT_RATE: QuoteVatRate = 23;

export const DISCOUNT_MAX = 100;
/** Domyślna ważność wyceny w dniach od wystawienia. */
export const QUOTE_VALID_DAYS = 14;

export interface QuoteDoc {
  /** Numer „W/A/2026/001” (seria urządzenia, rok, kolejny w roku); nadawany raz, przy pierwszym PDF-ie albo na żądanie. */
  number?: string;
  /** Data wystawienia i „ważna do” — dni „RRRR-MM-DD”. */
  issued?: string;
  validUntil?: string;
  /** Brak = bez VAT (ceny jak dotąd). `net`: ceny w wycenie są netto, VAT dochodzi; `gross`: ceny zawierają VAT. */
  vatMode?: QuoteVatMode;
  vatRate?: QuoteVatRate;
  /** Rabat na całość w procentach (0–100); brak = bez rabatu. */
  discount?: number;
  /** Uwagi i warunki: termin realizacji, zaliczka, gwarancja. */
  notes?: string;
  /** Zaliczka żądana od klienta przed rozpoczęciem prac (zł); brak = bez zaliczki. */
  deposit?: number;
  /** Zaliczka, która wpłynęła (zł) — kopia kwoty wpłaty zapisanej w rozliczeniach budowy (`quoteDeposit.ts`). */
  depositPaid?: number;
  /** Wysłana klientowi (PDF udostępniony), przyjęta, odrzucona (ms). */
  sentAt?: number;
  acceptedAt?: number;
  rejectedAt?: number;
}

export { cleanNotes, QUOTE_NOTES_MAX };

/**
 * Każde pole dokumentu jest albo „treścią dla klienta” (zmiana unieważnia wcześniejszy podpis, `signatureValidFor`), albo
 * metadanymi (numer, daty wystawienia, stan, wpłata zaliczki — zmiana podpisu nie rusza). Test pilnuje, że nowe pole `QuoteDoc`
 * trafia do jednej z dwóch list, zamiast po cichu zostać bez decyzji.
 */
export const CONTENT_FIELDS: readonly (keyof QuoteDoc)[] = ["validUntil", "vatMode", "vatRate", "discount", "notes", "deposit"];
export const META_FIELDS: readonly (keyof QuoteDoc)[] = ["number", "issued", "depositPaid", "sentAt", "acceptedAt", "rejectedAt"];
/** Wszystkie pola dokumentu — w Yjs każde ma własny klucz (`yJobs.ts`). */
export const QUOTE_DOC_FIELDS: readonly (keyof QuoteDoc)[] = [...CONTENT_FIELDS, ...META_FIELDS];

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_RE = /^W\/([A-Z0-9]{1,6})\/(\d{4})\/(\d+)$/;
const time = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined);
const day = (v: unknown) => (typeof v === "string" && DAY_RE.test(v) ? v : undefined);

/** Rabat z dokumentu: do dwóch miejsc po przecinku, 0 i śmieci to brak (`undefined`). */
export function cleanDiscount(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 && v <= DISCOUNT_MAX ? round2(v) : undefined;
}

/** Dokument wyceny z dowolnego wejścia (Yjs, kopia, peer) albo `null`, gdy nic w nim nie zostało. */
export function cleanQuoteDoc(raw: unknown): QuoteDoc | null {
  const d = raw as Partial<Record<keyof QuoteDoc, unknown>> | null;
  if (!d || typeof d !== "object") return null;
  const number = typeof d.number === "string" && NUMBER_RE.test(d.number) ? d.number : undefined;
  const issued = day(d.issued);
  const validUntil = day(d.validUntil);
  const vatMode = (QUOTE_VAT_MODES as readonly unknown[]).includes(d.vatMode) ? (d.vatMode as QuoteVatMode) : undefined;
  const vatRate = (QUOTE_VAT_RATES as readonly unknown[]).includes(d.vatRate) ? (d.vatRate as QuoteVatRate) : DEFAULT_VAT_RATE;
  const discount = cleanDiscount(d.discount);
  const notes = cleanNotes(d.notes);
  const deposit = cleanAmount(d.deposit);
  const depositPaid = cleanAmount(d.depositPaid);
  const sentAt = time(d.sentAt);
  const acceptedAt = time(d.acceptedAt);
  const rejectedAt = time(d.rejectedAt);
  const out: QuoteDoc = {
    ...(number ? { number } : {}),
    ...(issued ? { issued } : {}),
    ...(validUntil ? { validUntil } : {}),
    ...(vatMode ? { vatMode, vatRate } : {}),
    ...(discount !== undefined ? { discount } : {}),
    ...(notes ? { notes } : {}),
    ...(deposit !== undefined ? { deposit } : {}),
    ...(depositPaid !== undefined ? { depositPaid } : {}),
    ...(sentAt !== undefined ? { sentAt } : {}),
    ...(acceptedAt !== undefined ? { acceptedAt } : {}),
    ...(rejectedAt !== undefined ? { rejectedAt } : {}),
  };
  return Object.keys(out).length > 0 ? out : null;
}

/** „Ważna do”: zapisana albo, gdy nie ustawiono, data wystawienia + 14 dni (wyliczana, nie zapisywana — nadanie numeru nie zmienia treści dla klienta). */
export const effectiveValidUntil = (doc?: Pick<QuoteDoc, "issued" | "validUntil">): string | undefined =>
  doc?.validUntil ?? (doc?.issued ? addDaysKey(doc.issued, QUOTE_VALID_DAYS) : undefined);

export const formatQuoteNumber = (series: string, year: number, seq: number): string => `W/${cleanSeries(series)}/${year}/${String(seq).padStart(3, "0")}`;

export function parseQuoteNumber(n: string): { series: string; year: number; seq: number } | null {
  const m = NUMBER_RE.exec(n);
  return m ? { series: m[1], year: Number(m[2]), seq: Number(m[3]) } : null;
}

/** Następny numer serii w roku — największy istniejący + 1 (jak numeracja faktur: przeżywa kopię, bez osobnego licznika). */
export function nextQuoteNumber(series: string, year: number, existing: readonly string[]): string {
  const s = cleanSeries(series);
  let max = 0;
  for (const n of existing) {
    const p = parseQuoteNumber(n);
    if (p && p.series === s && p.year === year && p.seq > max) max = p.seq;
  }
  return formatQuoteNumber(s, year, max + 1);
}

export interface DocTotals {
  /** Kwota rabatu (zł); 0 bez rabatu. */
  discount: number;
  /** Przy VAT: netto, VAT i brutto po rabacie. */
  net?: number;
  vat?: number;
  vatRate?: QuoteVatRate;
  /** Do zapłaty przez klienta: po rabacie, z VAT (brutto) przy włączonym VAT. */
  payable: number;
}

/**
 * Sumy dokumentu od kwoty pozycji dla klienta (`subtotal` z `quoteTotals`): rabat na całość, potem VAT. Zaokrąglenia
 * do grosza w każdym kroku, żeby kwoty w panelu, PDF-ie i na fakturze były te same.
 */
export function applyQuoteDoc(subtotal: number, doc?: Pick<QuoteDoc, "discount" | "vatMode" | "vatRate">): DocTotals {
  const discount = round2(subtotal * (doc?.discount ?? 0) / 100);
  const after = round2(subtotal - discount);
  if (!doc?.vatMode) return { discount, payable: after };
  const rate = doc.vatRate ?? DEFAULT_VAT_RATE;
  if (doc.vatMode === "net") {
    const vat = round2(after * rate / 100);
    const gross = round2(after + vat);
    return { discount, net: after, vat, vatRate: rate, payable: gross };
  }
  const net = round2(after / (1 + rate / 100));
  return { discount, net, vat: round2(after - net), vatRate: rate, payable: after };
}

/** Stan wyceny do pokazania: wygrywa najnowszy znacznik (ponowne wysłanie po odrzuceniu albo przyjęciu to znowu „wysłana”); przy remisie przyjęta, potem odrzucona. */
export type QuoteState = "draft" | "sent" | "accepted" | "rejected";
export function quoteState(doc?: Pick<QuoteDoc, "sentAt" | "acceptedAt" | "rejectedAt">): QuoteState {
  if (!doc) return "draft";
  const s = doc.sentAt ?? 0;
  const a = doc.acceptedAt ?? 0;
  const r = doc.rejectedAt ?? 0;
  if (a === 0 && r === 0 && s === 0) return "draft";
  if (a >= r && a >= s) return "accepted";
  return r >= s ? "rejected" : "sent";
}
/** Chwila ostatniego znacznika stanu wyceny (wysłana, przyjęta, odrzucona); 0, gdy żadnego. */
export const quoteStamp = (doc?: Pick<QuoteDoc, "sentAt" | "acceptedAt" | "rejectedAt">): number => Math.max(doc?.sentAt ?? 0, doc?.acceptedAt ?? 0, doc?.rejectedAt ?? 0);

export const QUOTE_STATE_LABEL: Readonly<Record<QuoteState, string>> = { draft: "Szkic", sent: "Wysłana", accepted: "Przyjęta", rejected: "Odrzucona" };

/** „dziś”, „wczoraj”, „3 dni temu” — do pigułki stanu wyceny (dni kalendarzowe, nie 24-godzinne okna). */
export function sinceLabel(at: number, now: number = Date.now()): string {
  const days = Math.max(0, dayDiff(localDayKey(new Date(at)), localDayKey(new Date(now))));
  return days === 0 ? "dziś" : days === 1 ? "wczoraj" : `${days} ${pluralPl(days, ["dzień", "dni", "dni"])} temu`;
}
