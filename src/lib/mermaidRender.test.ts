import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MERMAID_VERSION } from "./mermaidRender";

// Plan Notatek 5.5: Mermaid leży w public/mermaid/<wersja>/ (scripts/copy-mermaid.mjs), a kod zna ścieżkę po stałej.
describe("Mermaid z własnego adresu", () => {
  it("wersja w kodzie zgadza się z package.json (inaczej ścieżka w public/mermaid byłaby martwa)", () => {
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as { dependencies: Record<string, string> };
    expect(pkg.dependencies.mermaid).toBe(MERMAID_VERSION);
  });
});
