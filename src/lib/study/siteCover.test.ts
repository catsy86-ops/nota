import { describe, expect, it } from "vitest";
import { siteCoverRef } from "./siteCover";
import type { JournalEntry } from "./yStudy";

const e = (id: string, at: number, images: string[], siteId = "lipowa"): JournalEntry =>
  ({ id, at, kind: "ok", topic: null, text: "x", site: "Lipowa 5", siteId, checked: [], images }) as JournalEntry;

describe("okładka karty budowy (P5.1)", () => {
  it("plan wygrywa z zdjęciami wpisów", () => {
    const docs = [{ id: "pdf", name: "P", size: 1, type: "application/pdf", at: 1 }, { id: "plan", name: "R", size: 1, type: "image/png", at: 2 }];
    expect(siteCoverRef([e("a", 5, ["img"])], { id: "lipowa", docs })).toBe("plan");
  });
  it("bez planu — najnowsze zdjęcie tej budowy", () => {
    const journal = [e("a", 1, ["stare"]), e("b", 9, ["nowe", "drugie"]), e("c", 20, ["obce"], "inna"), e("d", 30, [])];
    expect(siteCoverRef(journal, { id: "lipowa" })).toBe("nowe");
  });
  it("bez zdjęć — brak okładki", () => {
    expect(siteCoverRef([e("a", 1, [])], { id: "lipowa", docs: [] })).toBeNull();
  });
});
