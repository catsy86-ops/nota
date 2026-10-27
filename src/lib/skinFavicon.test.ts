import { describe, expect, it } from "vitest";
import { SKINS } from "@/lib/skinList";
import { applySkinFavicon, faviconHref } from "@/lib/skinFavicon";

describe("ikona karty w barwach stylu", () => {
  it("Zeszyt zostaje przy pliku marki, pozostałe style mają własne SVG", () => {
    expect(faviconHref("zeszyt")).toBe("/favicon.png");
    const others = SKINS.filter((s) => s !== "zeszyt").map(faviconHref);
    for (const href of others) expect(href).toMatch(/^data:image\/svg\+xml,/);
    expect(new Set(others).size).toBe(others.length);
  });

  it("podmienia href i typ linku ikony", () => {
    document.head.innerHTML = '<link rel="icon" href="/favicon.png" type="image/png" />';
    applySkinFavicon("neon");
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')!;
    expect(link.type).toBe("image/svg+xml");
    expect(decodeURIComponent(link.getAttribute("href")!)).toContain("#ff47d1");
    applySkinFavicon("zeszyt");
    expect(link.getAttribute("href")).toBe("/favicon.png");
  });
});
