/**
 * Kwota wpisana ręcznie w zł: „32,50”, „32.50”, „1 000”, „1 000,50”, „1.000,50”.
 * Każda spacja (zwykła, twarda, wąska) jest separatorem tysięcy i znika.
 * `null` = nie da się odczytać — wywołujący pokazuje błąd zamiast zapisywać
 * `NaN` albo cichy 1 zł. Puste pole to `0` (kwota nieustawiona), nie błąd.
 */
export function parseMoney(input: string): number | null {
  const s = input.replace(/\s/g, "");
  if (s === "") return 0;
  let normalized: string;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    // Ostatni z separatorów to część dziesiętna, reszta to tysiące.
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    normalized = s.split(thousands).join("").replace(decimal, ".");
  } else {
    normalized = s.replace(",", ".");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100) / 100;
}
