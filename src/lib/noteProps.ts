/**
 * Właściwości notatek (4b): własne pola typu Notion — tekst, liczba, data, wybór.
 * Definicje (nazwa, typ, opcje) żyją wspólnie w dokumencie; wartości — per notatka.
 * Moduł jest czysty: walidacja działa tak samo dla Y.Doc, kopii zapasowej i wpisu z formularza.
 */

export const PROP_TYPES = ["text", "number", "date", "select"] as const;
export type PropType = (typeof PROP_TYPES)[number];

export interface PropDef {
  id: string;
  name: string;
  type: PropType;
  /** Tylko dla `select`: dozwolone wartości, w kolejności pokazywania. */
  options?: string[];
  order: number;
}

/** Wartość właściwości: tekst, liczba albo data `YYYY-MM-DD` (też tekst). Brak klucza = puste pole. */
export type PropValue = string | number;
export type NoteProps = Record<string, PropValue>;

export const PROP_LIMITS = {
  defs: 30,
  name: 40,
  text: 500,
  options: 20,
  option: 40,
  id: 200,
  numberAbs: 1e12,
} as const;

export const PROP_TYPE_LABELS: Record<PropType, string> = {
  text: "Tekst",
  number: "Liczba",
  date: "Data",
  select: "Wybór",
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const NUMBER_TEXT = /^-?\d+(\.\d+)?$/;

function isValidIsoDate(s: string): boolean {
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return d <= daysInMonth;
}

/** Wartość z dowolnego wejścia (liczba z dokumentu, tekst z formularza). `undefined` = niepoprawna albo pusta. */
function coerce(def: PropDef, raw: unknown): PropValue | undefined {
  if (def.type === "number") {
    if (typeof raw === "number") {
      return Number.isFinite(raw) && Math.abs(raw) <= PROP_LIMITS.numberAbs ? raw : undefined;
    }
    if (typeof raw !== "string") return undefined;
    const s = raw.trim().replace(",", ".");
    if (!NUMBER_TEXT.test(s)) return undefined;
    const n = Number(s);
    return Math.abs(n) <= PROP_LIMITS.numberAbs ? n : undefined;
  }
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  if (def.type === "date") return isValidIsoDate(s) ? s : undefined;
  if (def.type === "select") return def.options?.includes(s) ? s : undefined;
  return s.length <= PROP_LIMITS.text ? s : undefined;
}

/**
 * Wejście z formularza komórki: `null` = wyczyść pole, `undefined` = niepoprawne
 * (wołający zostawia poprzednią wartość), wartość = zapisz.
 */
export function parsePropInput(def: PropDef, text: string): PropValue | null | undefined {
  if (!text.trim()) return null;
  return coerce(def, text);
}

/** Czyści wartości z dokumentu lub kopii: tylko klucze z identyfikatorem i poprawną wartością. */
export function cleanNoteProps(raw: unknown): NoteProps {
  const out: NoteProps = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  let count = 0;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= PROP_LIMITS.defs) break;
    if (!key || key.length > PROP_LIMITS.id) continue;
    if (typeof value === "number") {
      if (Number.isFinite(value) && Math.abs(value) <= PROP_LIMITS.numberAbs) { out[key] = value; count++; }
    } else if (typeof value === "string" && value.length <= PROP_LIMITS.text) {
      out[key] = value; count++;
    }
  }
  return out;
}

/** Wartość notatki dla danej definicji, zgodna z jej typem; inaczej `undefined` (traktowane jak puste). */
export function propValueFor(def: PropDef, props: NoteProps | undefined): PropValue | undefined {
  const raw = props?.[def.id];
  return raw === undefined ? undefined : coerce(def, raw);
}

/** Nowy słownik wartości po zmianie jednego pola; `null` kasuje wartość. Nie rusza reszty. */
export function withPropValue(props: NoteProps | undefined, propId: string, value: PropValue | null): NoteProps {
  const next = { ...(props ?? {}) };
  if (value === null) delete next[propId];
  else next[propId] = value;
  return next;
}

/** Tekst w polu: liczby z polskim przecinkiem, tak jak się je wpisuje. */
export function propDisplayText(def: PropDef, value: PropValue | undefined): string {
  if (value === undefined) return "";
  return def.type === "number" ? String(value).replace(".", ",") : String(value);
}

export function formatPropValue(def: PropDef, props: NoteProps | undefined): string {
  return propDisplayText(def, propValueFor(def, props));
}

/** Definicja z dowolnego wejścia; `null`, gdy brakuje id, nazwy albo typ jest nieznany. */
export function cleanPropDef(raw: unknown): PropDef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  if (!id || id.length > PROP_LIMITS.id) return null;
  const name = typeof r.name === "string" ? r.name.trim().slice(0, PROP_LIMITS.name) : "";
  if (!name) return null;
  const type = PROP_TYPES.find((t) => t === r.type);
  if (!type) return null;
  const order = typeof r.order === "number" && Number.isFinite(r.order) ? r.order : 0;
  if (type !== "select") return { id, name, type, order };
  const options: string[] = [];
  if (Array.isArray(r.options)) {
    for (const o of r.options) {
      if (options.length >= PROP_LIMITS.options) break;
      if (typeof o !== "string") continue;
      const t = o.trim().slice(0, PROP_LIMITS.option);
      if (t && !options.includes(t)) options.push(t);
    }
  }
  return { id, name, type, options, order };
}

/** Lista definicji: bez duplikatów id, po kolejności, najwyżej `PROP_LIMITS.defs`. */
export function cleanPropDefs(raw: unknown): PropDef[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: PropDef[] = [];
  for (const item of raw) {
    const def = cleanPropDef(item);
    if (!def || seen.has(def.id)) continue;
    seen.add(def.id);
    out.push(def);
  }
  return out.sort((a, b) => a.order - b.order).slice(0, PROP_LIMITS.defs);
}

/** Klucz porównania nazw pól: bez spacji na brzegach i bez wielkości liter. */
export function propNameKey(name: string): string {
  return name.trim().toLocaleLowerCase("pl");
}

/** Czy nazwa jest już zajęta (bez wielkości liter); `exceptId` pozwala zostawić nazwę własnej definicji. */
export function propNameTaken(defs: PropDef[], name: string, exceptId?: string): boolean {
  const n = propNameKey(name);
  return defs.some((d) => d.id !== exceptId && propNameKey(d.name) === n);
}

/** Definicja o tej nazwie (bez wielkości liter) — import dopasowuje pola z pliku po nazwie. */
export function findPropDefByName(defs: PropDef[], name: string): PropDef | undefined {
  const n = propNameKey(name);
  return defs.find((d) => propNameKey(d.name) === n);
}

/** Nowa definicja z formularza. `options` liczy się tylko dla wyboru. */
export function makePropDef(defs: PropDef[], name: string, type: PropType, options: string[] = [], id: string = crypto.randomUUID()): PropDef | null {
  const order = defs.reduce((max, d) => Math.max(max, d.order), -1) + 1;
  return cleanPropDef({ id, name, type, options: type === "select" ? options : undefined, order });
}

/**
 * Porównanie dwóch notatek po jednym polu. Puste wartości zawsze na końcu, niezależnie od kierunku
 * (inaczej przy malejącym sortowaniu wszystkie notatki bez liczby wpadałyby na górę).
 * Liczby porównywane jak liczby, reszta jak tekst z polskim porządkiem (`10` po `9`).
 */
export function comparePropsForSort(def: PropDef, a: NoteProps | undefined, b: NoteProps | undefined, dir: 1 | -1): number {
  const va = propValueFor(def, a);
  const vb = propValueFor(def, b);
  if (va === undefined || vb === undefined) return va === vb ? 0 : va === undefined ? 1 : -1;
  if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
  return String(va).localeCompare(String(vb), "pl", { numeric: true, sensitivity: "base" }) * dir;
}

/** Pola z wartością, w kolejności pokazywania, jako pary `[nazwa, tekst]` — do eksportu tekstowego. */
export function filledPropEntries(defs: PropDef[], props: NoteProps | undefined): [string, string][] {
  return [...defs]
    .sort((a, b) => a.order - b.order)
    .map((def): [string, string] => [def.name, formatPropValue(def, props)])
    .filter(([, text]) => text !== "");
}
