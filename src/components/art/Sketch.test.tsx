import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sketch } from "./Sketch";
import { SKINS } from "@/lib/skins";

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

describe("szkic pustych ekranów (plan motywów 2.1)", () => {
  it("rysuje ścieżki z opóźnieniem po kolei i podkreślenie na końcu; bez framer-motion", () => {
    const { container } = render(<Sketch paths={["M1 1 L2 2", "M3 3 L4 4"]} />);
    const lines = [...container.querySelectorAll("path.sketch-draw")];
    expect(lines).toHaveLength(3);
    expect(lines.map((p) => (p as SVGElement).style.getPropertyValue("--d"))).toEqual(["0.35s", "0.53s", "0.86s"]);
    expect(readFileSync(resolve(process.cwd(), "src/components/art/Sketch.tsx"), "utf8")).not.toMatch(/from "framer-motion"/);
  });

  it("każdy styl poza Zeszytem ma własną grubość kreski (--sketch-w)", () => {
    for (const skin of SKINS.filter((x) => x !== "zeszyt")) {
      expect(css.includes(`html[data-skin="${skin}"] { --sketch-w:`), skin).toBe(true);
    }
  });

  it("ograniczony ruch: rysunek od razu gotowy", () => {
    expect(css).toMatch(/html\[data-motion='reduced'\] \.sketch-draw \{ animation: none; stroke-dashoffset: 0; opacity: 1; \}/);
  });
});
