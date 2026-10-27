import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** CSS wszystkich stylów (`src/styles/skins/*.css`, plan motywów 0.4) sklejony w jeden tekst — dla testów tokenów. */
export function readSkinCss(): string {
  const dir = resolve(process.cwd(), "src/styles/skins");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".css"))
    .map((f) => readFileSync(resolve(dir, f), "utf8"))
    .join("\n");
}
