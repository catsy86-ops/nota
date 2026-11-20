import { describe, expect, it } from "vitest";
import { readAppCss } from "@/test/appCss";

/**
 * Powłoka 1.1 (WCAG 2.2.2): logo w nagłówku i pasku bocznym nie może animować się bez końca —
 * jeden przebieg przy pojawieniu się, powtórka tylko po najechaniu.
 */
const css = readAppCss();

describe("logo bez pętli (Powłoka 1.1)", () => {
  it("reguły .n-mark-* nie mają `infinite`", () => {
    const rules = css.split("}").filter((r) => r.includes(".n-mark"));
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) expect(r).not.toMatch(/infinite/);
  });
});
