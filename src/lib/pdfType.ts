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
