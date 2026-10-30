/**
 * Kod wyglądu (plan motywów 3.5): styl, jasność, akcent, kształt, tło, krój, rozmiar tekstu, styl na noc,
 * ramki, poświata, tryb budowa, ruch i pora roku jako jeden krótki tekst do przeniesienia na drugie urządzenie. Dane wyglądu są per urządzenie
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
  // Ramki i poświata (Wygląd): siła ramek, kolor krawędzi i tło kart, siła i barwa poświaty.
  "kaczy.frames.v1",
  "kaczy.frames.look.v1",
  "kaczy.glow.v1",
  // Plan motywów 2026-10-30 (1.5): tryb budowa, ruch i pora roku też są wyglądem.
  "kaczy.siteMode.v1",
  "kaczy.motion.v1",
  "kaczy.seasonTheme.v1",
  // Czarne tło w ciemnym (plan motywów 3.3).
  "kaczy.oled.v1",
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

/** Bieżące wartości wyglądu z localStorage (do „Cofnij” i zestawów). */
export function snapshotAppearance(read: (key: string) => string | null = (k) => localStorage.getItem(k)): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of APPEARANCE_KEYS) {
    const v = read(k);
    if (v !== null) out[k] = v;
  }
  return out;
}

/**
 * Ustawia wygląd bez przeładowania (plan motywów 2026-10-30, 1.4–1.5). `replace` — klucze spoza `values`
 * wracają do domyślnych (usunięcie z localStorage); bez niego zostają. Potem zdarzenie `storage` z `key: null`:
 * każdy magazyn ustawień (`createPersistedStore`, jasność w `useTheme`) słucha go dla zmian z innej karty
 * i czyta się od nowa, więc ta sama ścieżka odświeża wygląd w tej karcie.
 */
export function applyAppearanceValues(values: Record<string, string>, { replace }: { replace: boolean }): void {
  try {
    for (const k of APPEARANCE_KEYS) {
      const v = values[k];
      if (typeof v === "string") localStorage.setItem(k, v);
      else if (replace) localStorage.removeItem(k);
    }
  } catch { /* prywatne okno — zostaje, co było */ }
  window.dispatchEvent(new StorageEvent("storage", { key: null }));
}

/** Domyślny wygląd; zwraca poprzedni stan do „Cofnij”. */
export function resetAppearance(): Record<string, string> {
  const before = snapshotAppearance();
  applyAppearanceValues({}, { replace: true });
  return before;
}

/** Adres z kodem wyglądu: `<adres>/#wyglad=NOTKI1-…` (plan motywów 1.5). */
export function appearanceLink(code: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}/#wyglad=${encodeURIComponent(code)}`;
}

/** Kod wyglądu z fragmentu adresu (`#wyglad=…`); `null`, gdy adres go nie ma albo to nie kod. */
export function codeFromHash(hash: string): string | null {
  const m = /^#wyglad=([^&]+)/.exec(hash);
  if (!m) return null;
  let code: string;
  try { code = decodeURIComponent(m[1]!); } catch { return null; }
  return decodeAppearance(code) ? code : null;
}
