import type { jsPDF } from "jspdf";

/**
 * W8.2: skala pisma dokumentów PDF (punkty) — jedna dla wyceny, faktury, protokołu, raportu, rozliczenia i eksportu
 * notatek. Stopnie odpowiadają rolom z druku przeglądarki i ekranu (`docs/typografia.md`): tytuł dokumentu ≈ `title-page`,
 * podtytuł i suma ≈ `title-section`, nagłówek sekcji ≈ `title-card`, treść ≈ tekst interfejsu, tabela i drobny
 * druk ≈ `ui-meta`. Nowy rozmiar w dokumencie = nowy stopień tutaj, nie liczba w miejscu wywołania.
 */
export const PDF_TYPE = {
  /** Nazwa dokumentu („Wycena”, „Faktura VAT”, „Protokół odbioru”). */
  title: 16,
  /** Numer dokumentu, suma do zapłaty. */
  subtitle: 12,
  /** Nagłówek sekcji („Pozycje”, „Uwagi”). */
  heading: 11,
  /** Zwykły tekst. */
  body: 10,
  /** Komórki tabel i wiersze drugorzędne. */
  table: 9,
  /** Podpisy zdjęć, stopka, skrót pliku. */
  small: 8,
} as const;

/** Margines strony A4 w milimetrach — ten sam co `@page` w druku (`styles/app/print.css`). */
export const PDF_MARGIN_MM = 15;

/** Czcionka dokumentów: Barlow Condensed (`public/fonts/protokol-*.ttf`, OFL; budowa: `scripts/build-pdf-font.mjs`) — wbudowane fonty jsPDF nie mają ą, ę, ł, ś, ż. */
export const PDF_FONT = "Protokol";

/** Rejestruje obie wagi `PDF_FONT` w dokumencie jsPDF (pliki dociąga jsPDF z adresu aplikacji). */
export function addPdfFonts(doc: Pick<jsPDF, "addFont">): void {
  const base = typeof location !== "undefined" ? location.origin : "http://localhost";
  doc.addFont(new URL("/fonts/protokol-regular.ttf", base), PDF_FONT, "normal", 400, "Identity-H");
  // Styl "normal" + waga 700, nie "bold" + 700: jsPDF skleja styl z wagą i zapisywał krój jako "boldbold",
  // więc `setFont(PDF_FONT, "bold")` go nie znajdował i pogrubienia szły czcionką zastępczą bez polskich znaków.
  doc.addFont(new URL("/fonts/protokol-bold.ttf", base), PDF_FONT, "normal", 700, "Identity-H");
}
