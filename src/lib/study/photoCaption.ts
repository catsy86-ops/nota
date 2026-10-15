/**
 * Podpis wtopiony w zdjęcie z budowy („przed zakryciem”): pasek u dołu z tekstem
 * (pomieszczenie, miara) i datą. Wtopiony, a nie w danych wpisu — zdjęcie wysłane
 * szefowi albo inwestorowi niesie opis ze sobą, także poza aplikacją.
 */

export const CAPTION_MAX = 80;

export interface CaptionLayout {
  /** Wysokość czcionki w px. */
  font: number;
  /** Wysokość paska podpisu w px. */
  band: number;
  /** Margines poziomy tekstu w px. */
  pad: number;
  /** Linie tekstu (najwyżej 2; druga ucięta wielokropkiem). */
  lines: string[];
}

/**
 * Układ podpisu dla zdjęcia `width`×`height`. Czcionka skaluje się z krótszym bokiem
 * (czytelna i na pionowym, i na poziomym zdjęciu); `measure` mierzy szerokość tekstu
 * (canvas w przeglądarce, przybliżenie w testach).
 */
export function captionLayout(width: number, height: number, text: string, measure: (s: string, font: number) => number): CaptionLayout {
  const font = Math.max(14, Math.round(Math.min(width, height) * 0.045));
  const pad = Math.round(font * 0.8);
  const max = width - pad * 2;
  const words = text.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (measure(next, font) <= max || !line) { line = next; continue; }
    lines.push(line);
    line = w;
    if (lines.length === 2) break;
  }
  if (line && lines.length < 2) lines.push(line);
  // Więcej niż dwie linie — druga kończy się wielokropkiem.
  if (lines.length === 2 && words.join(" ").length > lines.join(" ").length) {
    let last = lines[1];
    while (last.length > 1 && measure(`${last}…`, font) > max) last = last.slice(0, -1);
    lines[1] = `${last.trimEnd()}…`;
  }
  const band = Math.round(pad * 1.2 + lines.length * font * 1.25);
  return { font, band, pad, lines };
}

/** „Łazienka, 58 cm · 15.10.2026” — tekst podpisu z datą wpisu. */
export function captionText(text: string, at: number): string {
  const d = new Date(at);
  const date = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  const t = text.trim().slice(0, CAPTION_MAX);
  return t ? `${t} · ${date}` : date;
}

/** Rysuje podpis na zdjęciu i zwraca nowy JPEG; `null`, gdy przeglądarka nie umie. */
export async function captionPhoto(blob: Blob, text: string): Promise<Blob | null> {
  if (typeof createImageBitmap !== "function") return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // JPEG nie ma przezroczystości — podkład jak w `imagePrepare`, inaczej PNG wychodzi na czarnym.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    const fontFor = (px: number) => `600 ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    const measure = (s: string, px: number) => { ctx.font = fontFor(px); return ctx.measureText(s).width; };
    const l = captionLayout(canvas.width, canvas.height, text, measure);
    // Pasek półprzezroczysty: zdjęcie pod spodem dalej widać, tekst czytelny na każdym tle.
    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    ctx.fillRect(0, canvas.height - l.band, canvas.width, l.band);
    ctx.fillStyle = "#ffffff";
    ctx.font = fontFor(l.font);
    ctx.textBaseline = "alphabetic";
    l.lines.forEach((line, i) => {
      const y = canvas.height - l.band + l.pad * 0.6 + l.font * (i + 1) * 1.25 - l.font * 0.25;
      ctx.fillText(line, l.pad, y);
    });
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  } finally {
    bitmap.close();
  }
}
