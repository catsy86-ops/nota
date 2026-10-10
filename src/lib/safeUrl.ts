/**
 * Adresy z treści notatek (Markdown) mogą pochodzić od peera albo z importu.
 * Dopuszczamy tylko schematy, które nie wykonują kodu: http(s), mailto, tel
 * oraz odnośniki względne (`#kotwica`, `/ścieżka`, `?q`). Wszystko inne —
 * `javascript:`, `data:`, `vbscript:`, `blob:`, `file:` — jest odrzucane.
 *
 * Przeglądarki ignorują białe znaki i znaki sterujące wewnątrz schematu
 * (`java\tscript:`), więc przed sprawdzeniem je usuwamy.
 */

const ALLOWED_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

// eslint-disable-next-line no-control-regex
const IGNORED_BY_URL_PARSER = /[\u0000-\u0020\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g;

export function isSafeHref(raw: string): boolean {
  if (typeof raw !== "string") return false;
  const compact = raw.replace(IGNORED_BY_URL_PARSER, "");
  if (!compact) return false;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact);
  if (scheme) return ALLOWED_SCHEMES.has(`${scheme[1].toLowerCase()}:`);
  // Bez schematu: kotwica albo ścieżka względna. Dwukropek przed pierwszym `/?#`
  // oznaczałby nietypowy schemat, którego regex wyżej nie rozpoznał.
  const head = compact.split(/[/?#]/)[0];
  return !head.includes(":");
}

/** Adres do `href`, albo `undefined`, gdy jest niebezpieczny (link wtedy nie jest klikalny). */
export function safeHref(raw: string | undefined): string | undefined {
  return raw !== undefined && isSafeHref(raw) ? raw : undefined;
}
