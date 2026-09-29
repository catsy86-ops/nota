/**
 * Polska odmiana po liczebniku: 1 notatka, 2–4 notatki (bez 12–14), reszta notatek.
 * `forms` = [jeden, kilka, wiele].
 */
export function pluralPl(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n);
  if (abs === 1) return forms[0];
  const last = abs % 10;
  const lastTwo = abs % 100;
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? forms[1] : forms[2];
}

/** „1 słowo”, „3 słowa”, „5 słów”. */
export const wordsPl = (n: number) => `${n} ${pluralPl(n, ["słowo", "słowa", "słów"])}`;

/** „1 znak”, „3 znaki”, „5 znaków”. */
export const charsPl = (n: number) => `${n} ${pluralPl(n, ["znak", "znaki", "znaków"])}`;
