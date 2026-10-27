import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { setShape } from "@/lib/shape";

describe("kształt — mnożnik promieni", () => {
  it("zapis ustawia atrybut na <html>, a zwykły go zdejmuje", () => {
    setShape("sharp");
    expect(document.documentElement.dataset.shape).toBe("sharp");
    setShape("soft");
    expect(document.documentElement.dataset.shape).toBe("soft");
    setShape("normal");
    expect(document.documentElement.dataset.shape).toBeUndefined();
  });

  it("wszystkie tokeny promieni idą za `--shape`", () => {
    const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
    for (const token of ["--radius", "--r-control", "--r-field", "--r-card"]) {
      expect(css).toMatch(new RegExp(`${token}: calc\\([^;]*var\\(--shape\\)\\);`));
    }
  });
});
