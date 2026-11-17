/**
 * Kod parowania (sekret grupy synchronizacji) — format, generator, parser (S2.2, `docs/plan-wymiana-kodu.md` §1).
 *
 * Dwa rodzaje z tego samego alfabetu 31 znaków (bez I/L/O/0/1):
 * - **długi, 28 znaków** (domyślny, D-W1): 26 losowych (≈ 128,8 bitu) i 2 kontrolne — liczone
 *   synchronicznie, więc pole wpisywania sprawdza je bez `crypto.subtle`;
 * - **krótki, 12 znaków** (≈ 59 bitów), bez znaków kontrolnych — tylko do przepisania ręcznie; wszystkie
 *   starsze grupy mają taki kod.
 *
 * Wejściem funkcji wyprowadzających (nazwy pokoi, hasło WebRTC, klucze przekaźnika) jest **cały napis**
 * kodu — dla długiego razem ze znakami kontrolnymi — więc kod 12-znakowy daje te same pokoje co dawniej.
 */

export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** Kod krótki. Nazwa bez przyrostka zostaje dla zgodności z resztą kodu. */
export const CODE_LENGTH = 12;
export const CODE_LENGTH_SHORT = CODE_LENGTH;
export const CODE_LENGTH_LONG = 28;
const LONG_RANDOM = CODE_LENGTH_LONG - 2;
const MOD = CODE_ALPHABET.length; // 31, liczba pierwsza

/** Dozwolone znaki kodu dla pola z kratkami (małe litery pole zamienia na wielkie). */
export const CODE_PATTERN = "^[A-HJKMNP-Za-hjkmnp-z2-9]*$";

export type CodeKind = "short" | "long";
export type CodeError = "length" | "checksum" | "chars";
export type ParsedCode = { code: string; kind: CodeKind; error?: undefined } | { code?: undefined; kind?: undefined; error: CodeError };

/**
 * Dwa znaki kontrolne dla 26 znaków: `k1 = Σ (i+1)·a[i] mod 31`, `k2 = Σ (i+1)²·a[i] mod 31`.
 * 31 jest pierwsze, a wagi 1…26 różne i niezerowe, więc `k1` wykrywa każdą pojedynczą pomyłkę i każdą
 * zamianę dwóch znaków miejscami; `k2` zbija szansę przepuszczenia dwóch pomyłek do ok. 1/961.
 */
export function checksumChars(body: string): string {
  let k1 = 0;
  let k2 = 0;
  for (let i = 0; i < body.length; i++) {
    const a = CODE_ALPHABET.indexOf(body[i]);
    const w = i + 1;
    k1 = (k1 + w * a) % MOD;
    k2 = (k2 + w * w * a) % MOD;
  }
  return CODE_ALPHABET[k1] + CODE_ALPHABET[k2];
}

function randomChars(count: number): string {
  // Odrzucanie bajtów z „ogona” — samo `% długość` faworyzowałoby pierwsze znaki alfabetu.
  const limit = 256 - (256 % MOD);
  let out = "";
  while (out.length < count) {
    for (const b of crypto.getRandomValues(new Uint8Array(count * 2))) {
      if (b < limit && out.length < count) out += CODE_ALPHABET[b % MOD];
    }
  }
  return out;
}

/** Losowy kod: długi domyślnie (D-W1), krótki tylko na wyraźne życzenie („Kod do przepisania ręcznie”). */
export function generateCode(kind: CodeKind = "long"): string {
  if (kind === "short") return randomChars(CODE_LENGTH_SHORT);
  const body = randomChars(LONG_RANDOM);
  return body + checksumChars(body);
}

/** Kod z pola lub linku: wielkie litery, bez spacji i myślników (kod jest wyświetlany w grupach). */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, "");
}

/**
 * Jedyny parser linku parowania: `pair` (kod) i `v=3` z tekstu — adresu, wklejonego linku albo odczytu z QR.
 * Fragment (`#pair=…`, obecny format) ma pierwszeństwo przed zapytaniem (`?pair=…`, stare linki); `v=3` liczy się
 * tylko w tej samej części co kod.
 */
export function pairParams(text: string): { pair: string | null; v3: boolean } {
  const hashAt = text.indexOf("#");
  const parts = hashAt >= 0 ? [text.slice(hashAt), text.slice(0, hashAt)] : [text];
  for (const part of parts) {
    const params = new Map<string, string>();
    for (const m of part.matchAll(/[?&#]([^=&#\s]+)=([^&#\s]*)/g)) if (!params.has(m[1])) params.set(m[1], m[2]);
    const pair = params.get("pair");
    if (pair) return { pair: safeDecode(pair), v3: params.get("v") === "3" };
  }
  return { pair: null, v3: false };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Kod z linku `#pair=…`/`?pair=…`, gdy tekst go zawiera; inaczej cały tekst. */
export function codeFromLinkOrText(raw: string): string {
  return pairParams(raw).pair ?? raw;
}

/**
 * Wklejony tekst → kod: przyjmuje cały link i kod w grupach, odrzuca znaki spoza alfabetu (np. kropkę
 * z końca zdania). Nie tnie do 12 — wklejenie 25 znaków dawałoby po cichu cudzą, pustą grupę; górna
 * granica to długość kodu długiego.
 */
export function codeFromPaste(raw: string): string {
  const code = normalizeCode(codeFromLinkOrText(raw));
  return [...code].filter((c) => CODE_ALPHABET.includes(c)).join("").slice(0, CODE_LENGTH_LONG);
}

/** Kod w grupach po 4 znaki — łatwiej przepisać z ekranu. */
export function formatCode(code: string): string {
  return code.match(/.{1,4}/g)?.join(" ") ?? code;
}

/**
 * Jedyne miejsce rozpoznawania kodu: dokładnie 12 znaków → krótki; dokładnie 28 z poprawnymi znakami
 * kontrolnymi → długi; wszystko inne → błąd (`chars` — znak spoza alfabetu, `length`, `checksum`).
 */
export function parseCode(raw: string): ParsedCode {
  const code = normalizeCode(codeFromLinkOrText(raw));
  if (![...code].every((c) => CODE_ALPHABET.includes(c))) return { error: "chars" };
  if (code.length === CODE_LENGTH_SHORT) return { code, kind: "short" };
  if (code.length !== CODE_LENGTH_LONG) return { error: "length" };
  if (checksumChars(code.slice(0, LONG_RANDOM)) !== code.slice(LONG_RANDOM)) return { error: "checksum" };
  return { code, kind: "long" };
}

/** Rodzaj zapisanego (już sprawdzonego) kodu — po samej długości. */
export function codeKind(code: string): CodeKind {
  return code.length === CODE_LENGTH_LONG ? "long" : "short";
}

/** Komunikat dla pola wpisywania. */
export function codeErrorText(error: CodeError): string {
  switch (error) {
    case "checksum":
      return "Sprawdź kod — jeden ze znaków się nie zgadza.";
    case "chars":
      return "Kod zawiera znak spoza alfabetu kodu (bez I, L, O, 0 i 1).";
    case "length":
      return "Kod ma 12 albo 28 znaków.";
  }
}
