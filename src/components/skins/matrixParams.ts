/**
 * Parametry deszczu matrix (styl Matryca). Osobno od komponentu, żeby Fast Refresh
 * i testy miały czyste funkcje.
 */

/** Znaki: katakana (połówkowe), cyfry i kilka liter — jak w oryginalnym motywie. */
export const MATRIX_GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ZXCVBN";

export const MATRIX_FPS = 24;
export const MATRIX_FRAME_MS = 1000 / MATRIX_FPS;

/** Liczba kolumn dla danej szerokości i wielkości znaku (czysta, testowalna). */
export function matrixColumns(width: number, fontPx: number): number {
  return Math.max(1, Math.ceil(width / Math.max(1, fontPx)));
}

/** Wielkość znaku: na palcu większa, żeby kolumny były rzadsze i lżejsze. */
export function matrixFontPx(coarse: boolean): number {
  return coarse ? 20 : 16;
}
