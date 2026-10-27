/**
 * Kod wyglądu (plan motywów 3.5): styl, jasność, akcent, kształt, tło, krój, rozmiar tekstu i styl na noc
 * jako jeden krótki tekst do przeniesienia na drugie urządzenie. Dane wyglądu są per urządzenie
 * (localStorage), nie w Yjs. Odczyt przepuszcza tylko klucze z listy; wartości sprawdzają potem same
 * moduły przy wczytaniu (`merge` w `createPersistedStore`), więc zły kod nie zepsuje ustawień.
 */
export const APPEARANCE_KEYS = [
  "kaczy.skin.v1",
  "kaczy-theme",
  "kaczy.skinScheme.v1",
  "kaczy.accent.v1",
  "kaczy.shape.v1",
  "kaczy.backdrop.v1",
  "kaczy.font.v1",
  "kaczy.textSize.v1",
  "kaczy.skinSchedule.v1",
] as const;

const PREFIX = "NOTKI1-";
/** Górna granica długości kodu — chroni przed wklejeniem czegoś zupełnie innego. */
const MAX_CODE = 4000;

const toBase64Url = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)));
};

export function encodeAppearance(read: (key: string) => string | null): string {
  const out: Record<string, string> = {};
  for (const k of APPEARANCE_KEYS) {
    const v = read(k);
    if (v !== null) out[k] = v;
  }
  return PREFIX + toBase64Url(JSON.stringify(out));
}

/** Wartości z kodu albo `null`, gdy to nie jest kod wyglądu. */
export function decodeAppearance(code: string): Record<string, string> | null {
  const c = code.replace(/\s+/g, "");
  if (!c.startsWith(PREFIX) || c.length > MAX_CODE) return null;
  try {
    const data: unknown = JSON.parse(fromBase64Url(c.slice(PREFIX.length)));
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const out: Record<string, string> = {};
    for (const k of APPEARANCE_KEYS) {
      const v = (data as Record<string, unknown>)[k];
      if (typeof v === "string" && v.length < 1000) out[k] = v;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}
