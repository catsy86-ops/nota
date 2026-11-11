/**
 * XML składany ręcznie z typowanych struktur — każda wartość od użytkownika przechodzi tędy (audyt bezpieczeństwa KSeF:
 * brak wstrzyknięcia węzłów, komentarzy ani CDATA).
 */

/** Usuwa znaki niedozwolone w XML 1.0 (sterujące poza tab/LF/CR, niesparowane surogaty, U+FFFE/FFFF). */
export function stripInvalidXml(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) { out += s[i] + s[i + 1]; i++; }
      continue;
    }
    if (c >= 0xdc00 && c <= 0xdfff) continue;
    if (c === 0x9 || c === 0xa || c === 0xd || (c >= 0x20 && c !== 0xfffe && c !== 0xffff)) out += s[i];
  }
  return out;
}

/** Tekst do treści elementu albo atrybutu: znaki niedozwolone usunięte, `& < > " '` zamienione na encje. */
export function escapeXml(s: string): string {
  return stripInvalidXml(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Element z tekstem; pusty tekst po oczyszczeniu daje pusty ciąg (element pomijany przez wołającego). */
export const tag = (name: string, text: string | number): string => `<${name}>${escapeXml(String(text))}</${name}>`;
