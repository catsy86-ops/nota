import type { MonthImageLayout, MonthImageLegendItem } from "./monthImage";
import { mergeMonthLegend } from "./monthImage";
import { shiftInk } from "./color";

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
const LEGEND_ROW_H = 30;
const INK = "#1f2937";
const MUTED = "#6b7280";
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Tekst z pełnej etykiety do wyświetlenia w komórce: kilka znaków max, bez wychodzenia poza kafelek. */
function fitLabel(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  let out = text;
  while (out.length > 1 && ctx.measureText(out).width > maxWidth) out = out.slice(0, -1);
  return out;
}

/** Motyw obrazu: jasny, ciemny albo kolory aktywnego stylu aplikacji. */
export type ImageTheme = "light" | "dark" | "style";

interface ImagePalette { bg: string; ink: string; muted: string; empty: string; chipInk: string }

/** Kolory obrazu. Dla „style” bierze tło i tekst z aktywnego motywu (zmienne CSS na `body`). */
export function imagePalette(theme: ImageTheme): ImagePalette {
  if (theme === "dark") return { bg: "#111827", ink: "#f9fafb", muted: "#9ca3af", empty: "#374151", chipInk: "#111827" };
  if (theme === "style" && typeof document !== "undefined") {
    const cs = getComputedStyle(document.body);
    return { bg: cs.backgroundColor, ink: cs.color, muted: cs.color, empty: "rgba(128, 128, 128, 0.25)", chipInk: "#111827" };
  }
  return { bg: "#ffffff", ink: INK, muted: MUTED, empty: "#e5e7eb", chipInk: INK };
}

/** Wysokość jednego miesiąca: tytuł, nagłówek dni, tygodnie i podsumowanie. */
function sectionHeight(l: MonthImageLayout): number {
  return TITLE_H + HEAD_H + l.weeks.length * ROW_H + PAD + l.footer.length * FOOT_LINE_H + PAD;
}

/** Legenda zawijana w wiersze: każdy rodzaj to kwadrat koloru i „skrót · nazwa”. */
function legendRows(ctx: CanvasRenderingContext2D, items: MonthImageLegendItem[]): MonthImageLegendItem[][] {
  const maxW = WIDTH - PAD * 2;
  ctx.font = `500 15px ${FONT}`;
  const rows: MonthImageLegendItem[][] = [];
  let row: MonthImageLegendItem[] = [];
  let used = 0;
  for (const item of items) {
    const w = 14 + 8 + ctx.measureText(`${item.short} · ${item.name}`).width + 24;
    if (row.length > 0 && used + w > maxW) { rows.push(row); row = []; used = 0; }
    row.push(item);
    used += w;
  }
  if (row.length > 0) rows.push(row);
  return rows;
}

/** Wysokość legendy pod wszystkimi miesiącami (0, gdy nic nie wystąpiło). */
function legendHeight(rows: MonthImageLegendItem[][]): number {
  return rows.length === 0 ? 0 : PAD / 2 + FOOT_LINE_H + rows.length * LEGEND_ROW_H + PAD;
}

/** Rysuje jeden miesiąc od góry `y0`. */
function drawSection(ctx: CanvasRenderingContext2D, layout: MonthImageLayout, p: ImagePalette, y0: number): void {
  const cell = (WIDTH - PAD * 2) / 7;

  ctx.fillStyle = p.ink;
  ctx.font = `700 30px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(layout.title, PAD, y0 + TITLE_H / 2);

  ctx.font = `600 16px ${FONT}`;
  ctx.fillStyle = p.muted;
  ctx.textAlign = "center";
  layout.weekdays.forEach((w, i) => ctx.fillText(w, PAD + cell * i + cell / 2, y0 + TITLE_H + HEAD_H / 2));

  layout.weeks.forEach((week, r) => {
    const top = y0 + TITLE_H + HEAD_H + r * ROW_H;
    week.forEach((c, i) => {
      const x = PAD + cell * i;
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, top + 0.5, cell - 1, ROW_H - 1);
      if (c.day === null) return;
      // Dziś: grubsza ramka w kolorze tekstu i pogrubiony numer (G4.7).
      if (c.today) {
        ctx.strokeStyle = p.ink;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x + 2, top + 2, cell - 4, ROW_H - 4);
      }
      ctx.fillStyle = c.today ? p.ink : p.muted;
      ctx.font = `${c.today ? 700 : 500} 15px ${FONT}`;
      ctx.textAlign = "left";
      ctx.fillText(String(c.day), x + 10, top + 16);
      if (c.label) {
        const chipW = cell - 28;
        const chipH = 36;
        const cy = top + ROW_H / 2 + 8;
        ctx.fillStyle = c.color ?? p.empty;
        ctx.beginPath();
        // L14: starsze przeglądarki nie mają roundRect — zwykły prostokąt zamiast wyjątku.
        if (ctx.roundRect) ctx.roundRect(x + 14, cy - chipH / 2, chipW, chipH, 10);
        else ctx.rect(x + 14, cy - chipH / 2, chipW, chipH);
        ctx.fill();
        // Tekst na kafelku z kolorem zmiany idzie w kontrastowy kolor tego kafelka (G0.2), a nie w stałą z palety.
        ctx.fillStyle = c.color ? shiftInk(c.color) : p.chipInk;
        ctx.font = `700 18px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillText(fitLabel(ctx, c.label, chipW - 12), x + cell / 2, cy);
      }
    });
  });

  const footTop = y0 + TITLE_H + HEAD_H + layout.weeks.length * ROW_H + PAD;
  ctx.fillStyle = p.ink;
  ctx.font = `500 17px ${FONT}`;
  ctx.textAlign = "left";
  layout.footer.forEach((line, i) => ctx.fillText(line, PAD, footTop + i * FOOT_LINE_H + FOOT_LINE_H / 2));
}

/**
 * Rysuje grafik na nowym canvasie: miesiące jeden pod drugim (G4.7), a na dole wspólna legenda rodzajów.
 * Wysokość zależy od liczby tygodni, wierszy podsumowania i liczby rodzajów w legendzie.
 */
export function renderMonthCanvas(layouts: MonthImageLayout[], scale = 2, theme: ImageTheme = "light"): HTMLCanvasElement {
  const p = imagePalette(theme);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d niedostępny");

  // Legendę mierzymy na tym samym kontekście, więc najpierw liczymy wiersze, potem ustawiamy wymiary.
  const rows = legendRows(ctx, mergeMonthLegend(layouts));
  const sections = layouts.reduce((sum, l) => sum + sectionHeight(l), 0);
  const height = sections + legendHeight(rows);
  canvas.width = WIDTH * scale;
  canvas.height = height * scale;
  ctx.scale(scale, scale);
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.textBaseline = "middle";

  let y = 0;
  for (const l of layouts) {
    drawSection(ctx, l, p, y);
    y += sectionHeight(l);
  }

  if (rows.length > 0) {
    const top = sections + PAD / 2;
    ctx.fillStyle = p.muted;
    ctx.font = `600 14px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText("Legenda", PAD, top + FOOT_LINE_H / 2);
    ctx.font = `500 15px ${FONT}`;
    rows.forEach((row, r) => {
      let x = PAD;
      const cy = top + FOOT_LINE_H + r * LEGEND_ROW_H + LEGEND_ROW_H / 2;
      for (const item of row) {
        ctx.fillStyle = item.color;
        ctx.fillRect(x, cy - 7, 14, 14);
        ctx.fillStyle = p.ink;
        ctx.textAlign = "left";
        const text = `${item.short} · ${item.name}`;
        ctx.fillText(text, x + 22, cy);
        x += 22 + ctx.measureText(text).width + 24;
      }
    });
  }
  return canvas;
}

/**
 * Synchronicznie (przez data URL, nie `toBlob`): udostępnianie musi ruszyć w tym samym kliknięciu,
 * a każde `await` przed `navigator.share` może zgubić aktywację użytkownika (L14).
 */
export function canvasToPng(canvas: HTMLCanvasElement): Blob {
  const bytes = Uint8Array.from(atob(canvas.toDataURL("image/png").split(",")[1]), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: "image/png" });
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
