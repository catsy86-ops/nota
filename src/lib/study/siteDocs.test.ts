import { describe, expect, it } from "vitest";
import { cleanSiteDocs, docLabel, SITE_DOCS_MAX } from "./siteDocs";

const H = (c: string) => c.repeat(64);

describe("dokumenty budowy", () => {
  it("czyszczenie: klucz magazynu, tylko obraz albo PDF, bez dubli, od najstarszego", () => {
    expect(cleanSiteDocs([
      { id: H("b"), name: "rzut.pdf", size: 1000, type: "application/pdf", at: 2 },
      { id: H("a"), name: "../tablica.jpg", size: 50, type: "image/jpeg", at: 1 },
      { id: H("a"), name: "dubel.jpg", size: 50, type: "image/jpeg", at: 3 },
      { id: "zly", name: "x.pdf", size: 1, type: "application/pdf", at: 4 },
      { id: H("c"), name: "skrypt.html", size: 1, type: "text/html", at: 5 },
    ])).toEqual([
      { id: H("a"), name: "tablica.jpg", size: 50, type: "image/jpeg", at: 1 },
      { id: H("b"), name: "rzut.pdf", size: 1000, type: "application/pdf", at: 2 },
    ]);
    const many = Array.from({ length: SITE_DOCS_MAX + 3 }, (_, i) => ({ id: i.toString(16).padStart(64, "0"), name: "p.pdf", size: 1, type: "application/pdf", at: i }));
    expect(cleanSiteDocs(many)).toHaveLength(SITE_DOCS_MAX);
    expect(cleanSiteDocs(null)).toBeUndefined();
  });

  it("podpis bez rozszerzenia", () => {
    expect(docLabel({ name: "Rzut parteru.pdf" })).toBe("Rzut parteru");
  });
});
