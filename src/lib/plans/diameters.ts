import type { SymbolType, SystemType } from "./model";
import { COMMON_DIAMETERS, SYMBOL_META, SYSTEM_META } from "./systems";

/**
 * Odczyt opisów z planu (OCR): średnice i oznaczenia instalacji. Tesseract często myli „Ø” z „0”, „O”,
 * „@” albo „Q”, a „⌀” bywa „φ” — normalizujemy znaki i podajemy pewność. Wynik to zawsze PROPOZYCJA:
 * do trasy przypisuje ją dopiero użytkownik.
 */

/** Znaki średnicy po normalizacji: wszystkie odmiany → „Ø”. */
export function normalizeOcrText(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[⌀∅φΦøϕ]/g, "Ø")
    .replace(/[×хХ]/g, "x")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export type DiameterForm = "Ø" | "DN" | "dim" | "guess";

export interface ParsedDiameter {
  mm: number;
  form: DiameterForm;
  /** 0–1: „Ø16” i „DN25” pewne, „16x2” prawie, „016” to zgadywanie z listy typowych średnic. */
  confidence: number;
}

const COMMON = new Set<number>(COMMON_DIAMETERS);
const num = (s: string) => Number(s.replace(",", "."));

export function parseDiameter(raw: string): ParsedDiameter | null {
  const t = normalizeOcrText(raw);
  let m = /Ø\s?(\d{1,3}(?:[.,]\d)?)/.exec(t);
  if (m) { const mm = num(m[1]); if (mm >= 6 && mm <= 1000) return { mm, form: "Ø", confidence: 1 }; }
  m = /\bDN\s?(\d{2,4})\b/i.exec(t);
  if (m) { const mm = num(m[1]); if (mm >= 6 && mm <= 1000) return { mm, form: "DN", confidence: 1 }; }
  // Wymiar rury „16x2”, „20x2,8”, „110x3,2”: średnica zewnętrzna x grubość ścianki.
  m = /(?:^|[^\d])(\d{2,3})\s?x\s?\d{1,2}(?:[.,]\d)?(?!\d)/i.exec(t);
  if (m) { const mm = num(m[1]); if (COMMON.has(mm) || (mm >= 10 && mm <= 400)) return { mm, form: "dim", confidence: 0.85 }; }
  // „Ø” przeczytane jako 0/O/o/Q/@ tuż przed liczbą: tylko typowe średnice, z niższą pewnością.
  m = /(?:^|[\s(/])[0OoQ@D]\s?(\d{2,3})(?![\d.,])/.exec(t);
  if (m) { const mm = num(m[1]); if (COMMON.has(mm)) return { mm, form: "guess", confidence: 0.6 }; }
  // „Ø” przeczytane jako „2” („216 ZW”, częste na ciemnym tle FastView): tylko obok kodu instalacji —
  // samo „220” albo wymiar „225” nie jest średnicą.
  m = /(?:^|[\s(/])2(\d{2})(?![\d.,])/.exec(t);
  if (m && parseSystemCode(t)) { const mm = num(m[1]); if (COMMON.has(mm)) return { mm, form: "guess", confidence: 0.5 }; }
  return null;
}

/** Oznaczenia instalacji spotykane na planach wod-kan i CO. */
const SYSTEM_CODES: [RegExp, SystemType][] = [
  [/\b(?:ZW|Z\.W\.|WZ|ZIMNA)\b/i, "cold"],
  [/\b(?:CWU|C\.W\.U\.|CW|CYRK(?:ULACJA)?)\b/i, "hot"],
  [/\b(?:CO|C\.O\.|ZCO|PCO|ZAS(?:ILANIE)?|POWR(?:ÓT|OT)?)\b/i, "heating"],
  [/\b(?:KAN|KS|KD|KT|KANALIZACJA)\b/i, "sewage"],
];

export function parseSystemCode(raw: string): SystemType | null {
  const t = normalizeOcrText(raw);
  for (const [re, system] of SYSTEM_CODES) if (re.test(t)) return system;
  // Samo „C” to ciepła woda tylko jako cały opis — inaczej każde „C” w zdaniu byłoby ciepłą wodą.
  return /^C$/i.test(t) ? "hot" : null;
}

/** Punkty poboru i armatura opisane skrótem (WC, UM — umywalka, ZL — zlew, WM — pralka, ZM — zmywarka, NW — natrysk). */
const SYMBOL_CODES: [RegExp, SymbolType][] = [
  [/\b(?:WC|UM|UMYW(?:ALKA)?|ZL|ZLEW(?:OZMYWAK)?|WM|PRALKA|ZM|ZMYW(?:ARKA)?|NW|NATRYSK|WANNA|BD|BIDET|PI|PISUAR)\b/i, "outlet"],
  [/\b(?:ZAW(?:ÓR|OR)?|ZK|ZWR|ZZ)\b/i, "valve"],
  [/\b(?:ROZDZ(?:IELACZ)?|RW)\b/i, "manifold"],
  [/\b(?:PION|P\d{1,2})\b/i, "riser"],
];

export function parseSymbolCode(raw: string): SymbolType | null {
  const t = normalizeOcrText(raw);
  for (const [re, type] of SYMBOL_CODES) if (re.test(t)) return type;
  return null;
}

export interface OcrMeaning {
  diameter: ParsedDiameter | null;
  system: SystemType | null;
  symbol: SymbolType | null;
}

/** Co znaczy odczytany napis; `null` = nic przydatnego dla zestawienia (zwykłe słowo, wymiar pokoju). */
export function interpretOcrText(raw: string): OcrMeaning | null {
  const diameter = parseDiameter(raw);
  const system = parseSystemCode(raw);
  const symbol = parseSymbolCode(raw);
  return diameter || system || symbol ? { diameter, system, symbol } : null;
}

/** Zatwierdzanie hurtem: tylko propozycje OCR co najmniej tak pewne. */
export const OCR_SURE = 0.8;

/** „Ø16 · Zimna woda · Punkt poboru” — co program zrozumiał z napisu. */
export function meaningLabel(m: OcrMeaning | null): string {
  if (!m) return "bez znaczenia dla zestawienia";
  return [
    m.diameter && `Ø${String(m.diameter.mm).replace(".", ",")}${m.diameter.form === "guess" ? " (?)" : ""}`,
    m.system && SYSTEM_META[m.system].label,
    m.symbol && SYMBOL_META[m.symbol].label,
  ].filter(Boolean).join(" · ");
}
