import { describe, expect, it } from "vitest";
import { handoverPdfName, photoPages } from "./handoverPdf";

describe("protokół PDF (P2.5)", () => {
  it("zdjęcia dzielą się na strony po 6 (2×3)", () => {
    expect(photoPages(0)).toEqual([]);
    expect(photoPages(4)).toEqual([4]);
    expect(photoPages(6)).toEqual([6]);
    expect(photoPages(7)).toEqual([6, 1]);
    expect(photoPages(13)).toEqual([6, 6, 1]);
  });

  it("nazwa pliku bez znaków ze ścieżek, z polskimi literami", () => {
    expect(handoverPdfName("Lipowa 5")).toBe("Protokol odbioru - Lipowa 5.pdf");
    expect(handoverPdfName("Os. Słoneczne/12: dom?")).toBe("Protokol odbioru - Os. Słoneczne 12 dom.pdf");
    expect(handoverPdfName("   ")).toBe("Protokol odbioru - budowa.pdf");
  });
});
