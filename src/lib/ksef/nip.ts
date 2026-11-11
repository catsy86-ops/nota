/** NIP: dokładnie 10 cyfr z poprawną sumą kontrolną (wagi 6 5 7 2 3 4 5 6 7, modulo 11, reszta 10 jest niedozwolona). */
export const normalizeNip = (raw: string): string => raw.replace(/[\s-]/g, "").replace(/^PL/i, "");

export function isValidNip(raw: string): boolean {
  const nip = normalizeNip(raw);
  if (!/^\d{10}$/.test(nip)) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((s, w, i) => s + w * Number(nip[i]), 0);
  const check = sum % 11;
  return check !== 10 && check === Number(nip[9]);
}
