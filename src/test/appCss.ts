import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const INDEX = resolve(process.cwd(), "src/index.css");

/**
 * W6.5: `src/index.css` po podziale to lista importów `src/styles/app/*.css`. Testy, które czytały ten plik
 * (tokeny, kontrast, skróty utility), dostają tu jego treść sklejoną w kolejności importów — tak jak skleja ją
 * Tailwind przy budowie. Importy pakietów (`tailwindcss`, `tw-animate-css`) zostają jako linie `@import`.
 */
export function readAppCss(): string {
  const index = readFileSync(INDEX, "utf8");
  return index.replace(/^@import\s+["'](\.\/[^"']+)["'];\s*$/gm, (_, rel: string) => readFileSync(resolve(dirname(INDEX), rel), "utf8"));
}
