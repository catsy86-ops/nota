import type { MonthImageLayout } from "./monthImage";

/**
 * Rysowanie układu miesiąca na canvasie i udostępnianie PNG. Ładowane leniwie z widoku Grafiku,
 * żeby nie dokładać kodu do paczki startowej. Kolory tekstu dobrane do białego tła (druk, czytnik).
 */

const WIDTH = 900;
const PAD = 32;
const TITLE_H = 64;
const HEAD_H = 36;
const ROW_H = 96;
const FOOT_LINE_H = 26;
const INK = "#1f2937";
const MUTED = "#6b7280";
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Tekst z pełnej etykiety do wyświetlenia w komórce: kilka znaków max, bez wychodzenia poza kafelek. */
function fitLabel(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  let out = text;
  while (out.length > 1 && ctx.measureText(out).width > maxWidth) out = out.slice(0, -1);
  return out;
}

/** Rysuje grafik miesiąca na nowym canvasie. Wysokość zależy od liczby tygodni i wierszy podsumowania. */
export function renderMonthCanvas(layout: MonthImageLayout, scale = 2): HTMLCanvasElement {
  const cols = 7;
  const cell = (WIDTH - PAD * 2) / cols;
  const height = TITLE_H + HEAD_H + layout.weeks.length * ROW_H + PAD + layout.footer.length * FOOT_LINE_H + PAD;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d niedostępny");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.textBaseline = "middle";

  ctx.fillStyle = INK;
  ctx.font = `700 30px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(layout.title, PAD, TITLE_H / 2);

  ctx.font = `600 16px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  layout.weekdays.forEach((w, i) => ctx.fillText(w, PAD + cell * i + cell / 2, TITLE_H + HEAD_H / 2));

  layout.weeks.forEach((week, r) => {
    const top = TITLE_H + HEAD_H + r * ROW_H;
    week.forEach((c, i) => {
      const x = PAD + cell * i;
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, top + 0.5, cell - 1, ROW_H - 1);
      if (c.day === null) return;
      ctx.fillStyle = MUTED;
      ctx.font = `500 15px ${FONT}`;
      ctx.textAlign = "left";
      ctx.fillText(String(c.day), x + 10, top + 16);
      if (c.label) {
        const chipW = cell - 28;
        const chipH = 36;
        const cy = top + ROW_H / 2 + 8;
        ctx.fillStyle = c.color ?? "#e5e7eb";
        ctx.beginPath();
        // L14: starsze przeglądarki nie mają roundRect — zwykły prostokąt zamiast wyjątku.
        if (ctx.roundRect) ctx.roundRect(x + 14, cy - chipH / 2, chipW, chipH, 10);
        else ctx.rect(x + 14, cy - chipH / 2, chipW, chipH);
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.font = `700 18px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillText(fitLabel(ctx, c.label, chipW - 12), x + cell / 2, cy);
      }
    });
  });

  const footTop = TITLE_H + HEAD_H + layout.weeks.length * ROW_H + PAD;
  ctx.fillStyle = INK;
  ctx.font = `500 17px ${FONT}`;
  ctx.textAlign = "left";
  layout.footer.forEach((line, i) => ctx.fillText(line, PAD, footTop + i * FOOT_LINE_H + FOOT_LINE_H / 2));
  return canvas;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("nie udało się zapisać obrazu"))), "image/png");
  });
}

/**
 * Udostępnia PNG przez systemowe okno udostępniania (jeśli telefon je ma i przyjmuje pliki),
 * w przeciwnym razie pobiera plik. Anulowanie okna nie jest błędem.
 * Zwraca, co zrobiono: `"shared"` albo `"downloaded"`.
 */
export async function shareMonthPng(blob: Blob, filename: string, title: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return "shared";
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return "cancelled";
      // Inny błąd udostępniania — spadamy do pobrania.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // L14: zwolnienie adresu po chwili — Safari potrafi go zwolnić zanim pobieranie ruszy.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
