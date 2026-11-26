/**
 * L2.3 Dane do przelewu w wiadomościach (Długi): numer konta i telefon do BLIK-a. Czyszczenie listą dozwolonych
 * znaków, nie listą zakazanych — po NFKC i zdjęciu spacji, myślników i znaków formatu (zerowa szerokość, przełączniki
 * kierunku) zostać mogą tylko litery A–Z i cyfry. To zamyka homoglify, cyfry innych pism i odwracanie tekstu.
 * Czysta logika, bez magazynu.
 */

export const ACCOUNT_INPUT_MAX = 48;
const STRIP = /[\s\-\p{Cf}]/gu;
const IBAN_RE = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

export type AccountStatus = "empty" | "invalid" | "badChecksum" | "ok";

/** Suma kontrolna IBAN (ISO 13616, mod 97). */
export function ibanChecksumOk(iban: string): boolean {
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const ch of moved) {
    const v = ch >= "A" && ch <= "Z" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

/**
 * Numer konta → postać kanoniczna (IBAN bez spacji; 26 cyfr = polskie konto, dopisane „PL”) i stan. `invalid` — po
 * czyszczeniu zostały znaki spoza listy albo zła długość; wtedy `value` jest puste. `badChecksum` — kształt dobry,
 * suma zła: zapisujemy (do poprawienia), ale do wiadomości nie trafia — literówka w koncie jest gorsza niż brak konta.
 */
export function cleanAccount(raw: unknown): { value: string; status: AccountStatus } {
  if (typeof raw !== "string") return { value: "", status: "empty" };
  const s = raw.slice(0, ACCOUNT_INPUT_MAX * 2).normalize("NFKC").toUpperCase().replace(STRIP, "");
  if (!s) return { value: "", status: "empty" };
  const iban = /^\d{26}$/.test(s) ? `PL${s}` : s;
  // Polski IBAN ma zawsze 28 znaków; inne kraje — tylko ogólny kształt i suma kontrolna.
  if (!IBAN_RE.test(iban) || (iban.startsWith("PL") && iban.length !== 28)) return { value: "", status: "invalid" };
  return { value: iban, status: ibanChecksumOk(iban) ? "ok" : "badChecksum" };
}

/** IBAN w grupach po 4: „PL61 1090 1014 …”. */
export const formatAccount = (iban: string) => iban.replace(/(.{4})(?=.)/g, "$1 ");

/** Telefon do BLIK-a: dokładnie 9 cyfr po zdjęciu +48/0048, spacji i myślników; inaczej `null`. */
export function cleanBlik(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.slice(0, 40).normalize("NFKC").replace(STRIP, "").replace(/^(\+48|0048)/, "");
  return /^\d{9}$/.test(s) ? s : null;
}

/** „600123456” → „600 123 456”. */
export const formatBlik = (phone: string) => phone.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");

/** Linia płatności do wiadomości z poprawnych danych; `null`, gdy nie ma czego dopisać. */
export function paymentLine(d: { account?: string; blik?: string }): string | null {
  const acc = cleanAccount(d.account);
  const blik = cleanBlik(d.blik);
  const parts = [acc.status === "ok" ? `Przelew: ${formatAccount(acc.value)}` : null, blik ? `BLIK: ${formatBlik(blik)}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
