/**
 * Wspólny CSV pod polski Excel (C3.5; wcześniej kopia w Długach): separator „;”, BOM UTF-8, CRLF, przecinek
 * dziesiętny. Tekst zaczynający się od `=`, `+`, `-`, `@`, tabulatora albo CR dostaje apostrof — wpis użytkownika
 * nie może stać się formułą w arkuszu (wstrzykiwanie formuł CSV). Liczby idą osobno (`csvNumber`), bez apostrofu:
 * minus w liczbie to znak, nie formuła.
 */

const CRLF = "\r\n";
const BOM = "﻿";

/** Pole tekstowe: apostrof przed znakiem formuły, cudzysłowy przy `;`, `"` i końcach linii. */
export function csvText(v: string): string {
  const s = v.length > 0 && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Liczba z przecinkiem dziesiętnym; `digits` — stała liczba miejsc po przecinku. Brak wartości — puste pole. */
export function csvNumber(n: number | undefined | null, digits?: number): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "";
  return (digits === undefined ? String(n) : n.toFixed(digits)).replace(".", ",");
}

/** Gotowe wiersze (już zakodowane pola) → plik: BOM, CRLF, CRLF na końcu. */
export function csvDocument(rows: readonly (readonly string[])[]): string {
  return BOM + rows.map((r) => r.join(";")).join(CRLF) + CRLF;
}
