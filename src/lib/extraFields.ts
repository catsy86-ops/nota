/**
 * Zachowanie nieznanych pól wpisów w mapach Yjs (Z-17.3, `docs/plan-zgodnosc-i-obieg.md` §1.5). Wpis w mapie to jedna
 * wartość podmieniana w całości, a `clean*` buduje go ze znanych pól — bez tego pole dopisane przez nowszą wersję
 * ginęłoby przy pierwszej edycji na tej. Limity chronią przed rozdmuchaniem dokumentu przez peera.
 */

const KEY_RE = /^[a-z][A-Za-z0-9]{0,23}$/;
const MAX_KEYS = 8;
const MAX_STRING = 200;
const MAX_ARRAY = 16;
const MAX_BYTES = 512;

type Scalar = string | number | boolean;

function scalar(v: unknown): v is Scalar {
  if (typeof v === "string") return v.length <= MAX_STRING;
  if (typeof v === "number") return Number.isFinite(v);
  return typeof v === "boolean";
}

function allowed(v: unknown): boolean {
  return scalar(v) || (Array.isArray(v) && v.length <= MAX_ARRAY && v.every(scalar));
}

/** Nieznane klucze surowego wpisu (do odłożenia w `extra`); `undefined`, gdy ich nie ma. */
export function pickExtra(raw: object, known: readonly string[]): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const key of Object.keys(raw)) {
    if (n >= MAX_KEYS) break;
    if (key === "extra" || key === "v" || known.includes(key) || !KEY_RE.test(key)) continue;
    const value = (raw as Record<string, unknown>)[key];
    if (!allowed(value)) continue;
    out[key] = Array.isArray(value) ? [...value] : value;
    n++;
  }
  if (n === 0) return undefined;
  let size: number;
  try { size = new TextEncoder().encode(JSON.stringify(out)).length; } catch { return undefined; }
  return size <= MAX_BYTES ? out : undefined;
}

/**
 * Nieznane pola: z surowego wpisu z mapy albo — gdy to wpis z pamięci — z jego pola `extra`. Oba przez `pickExtra`,
 * więc wpis z pamięci też nie przemyci niczego ponad limity.
 */
export function extraOf(raw: object, known: readonly string[]): Record<string, unknown> | undefined {
  const fromRaw = pickExtra(raw, known);
  const mem = (raw as { extra?: unknown }).extra;
  const fromMem = mem && typeof mem === "object" && !Array.isArray(mem) ? pickExtra(mem, known) : undefined;
  if (!fromRaw) return fromMem;
  if (!fromMem) return fromRaw;
  return pickExtra({ ...fromRaw, ...fromMem }, known);
}

/** Kształt do zapisu w Yjs i w kopii: nieznane pola na wierzchu, znane je nadpisują; klucza `extra` nie ma. */
export function toStored<T extends { extra?: Record<string, unknown> }>(entry: T): Omit<T, "extra"> {
  const { extra, ...rest } = entry;
  return extra ? ({ ...extra, ...rest } as Omit<T, "extra">) : rest;
}

/**
 * Minimalna wersja czytelnika (§1.5): `v` większe niż `supported` — wpis niewidoczny dla tej wersji (zła liczba
 * byłaby gorsza niż brak wpisu). Brak `v` albo wartość spoza 1–1000 — wpis zwykły.
 */
export function tooNew(raw: object, supported: number): boolean {
  const v = (raw as { v?: unknown }).v;
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 1000 && v > supported;
}

/** `v` do zachowania we wpisie (ta sama wersja albo starsza niż obsługiwana). */
export function keepV(raw: object): { v?: number } {
  const v = (raw as { v?: unknown }).v;
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 1000 ? { v } : {};
}
