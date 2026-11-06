import { describe, expect, it } from "vitest";
import { coverPhotoCount, COVER_CAPTION, COVER_STAGE_ID } from "./coverPhotos";
import { siteKey } from "./siteKey";
import type { JournalEntry } from "./yStudy";

const entry = (id: string, extra: Partial<JournalEntry>) =>
  ({ id, at: 1, kind: "ok", topic: null, text: "", site: "Lipowa 5", checked: [], images: [], ...extra }) as unknown as JournalEntry;

describe("zdjęcia przed zakryciem (P2.2)", () => {
  it("liczy zdjęcia przypięte do etapu zakrycia tej budowy", () => {
    const journal = [
      entry("a", { stage: COVER_STAGE_ID, images: ["x1", "x2"] }),
      entry("b", { stage: COVER_STAGE_ID, images: ["x3"] }),
      entry("c", { stage: "proba", images: ["x4"] }),
      entry("d", { images: ["x5"] }),
      entry("e", { site: "Polna 2", stage: COVER_STAGE_ID, images: ["x6"] }),
    ];
    expect(coverPhotoCount(journal, siteKey("Lipowa 5"))).toBe(3);
    expect(coverPhotoCount(journal, siteKey("Polna 2"))).toBe(1);
    expect(coverPhotoCount([], siteKey("Lipowa 5"))).toBe(0);
  });
  it("podpis i etap mają stałe wartości", () => {
    expect(COVER_STAGE_ID).toBe("zakrycie");
    expect(COVER_CAPTION).toBe("Przed zakryciem");
  });
});
