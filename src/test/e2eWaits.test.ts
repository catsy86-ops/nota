import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * A4.3: stałe odczekanie (`waitForTimeout`) w e2e to zgadywanie — pod obciążeniem za krótkie, bez niego za długie.
 * Zamiast niego: stan (`expect.poll`, `toBeVisible`, `whenSaved`, `untilStill`, `untilOpaque` z `e2e/helpers.ts`).
 * Zostaje tylko tam, gdzie czas jest częścią testu (przytrzymanie, tempo gestu, sprawdzenie braku po czasie) — wtedy
 * z komentarzem `czas: <powód>` w tej samej linii — oraz w testach pomiarowych, które mierzą czas i klatki.
 */
const e2e = resolve(__dirname, "../../e2e");
const MEASURING = new Set(["motion-frames.spec.ts", "motion-video.spec.ts", "web-vitals-phone.spec.ts", "render-count.spec.ts", "perf.spec.ts", "restore-perf.spec.ts"]);

describe("e2e bez zgadywania czasu (A4.3)", () => {
  it("każde waitForTimeout poza testami pomiarowymi ma komentarz `czas:` z powodem", () => {
    const offenders: string[] = [];
    for (const file of readdirSync(e2e).filter((f) => f.endsWith(".ts") && !MEASURING.has(f))) {
      readFileSync(resolve(e2e, file), "utf8").split(/\r?\n/).forEach((line, i) => {
        if (/\.waitForTimeout\(/.test(line) && !/\/\/ czas: \S/.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("lista testów pomiarowych nie ma martwych wpisów", () => {
    const files = new Set(readdirSync(e2e));
    expect([...MEASURING].filter((f) => !files.has(f))).toEqual([]);
  });
});
