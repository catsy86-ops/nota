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
