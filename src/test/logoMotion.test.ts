import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Powłoka 1.1 (WCAG 2.2.2): logo w nagłówku i pasku bocznym nie może animować się bez końca —
 * jeden przebieg przy pojawieniu się, powtórka tylko po najechaniu.
 */
const css = readFileSync(join(__dirname, "..", "index.css"), "utf8");

describe("logo bez pętli (Powłoka 1.1)", () => {
  it("reguły .n-mark-* nie mają `infinite`", () => {
    const rules = css.split("}").filter((r) => r.includes(".n-mark"));
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) expect(r).not.toMatch(/infinite/);
  });
});
