import { beforeEach, describe, expect, it, vi } from "vitest";
import { yjsStore } from "@/lib/yjsStore";
import { STUDY_STORAGE_KEY } from "./keys";
import { journalImageRefs } from "./images";
import { resetStudyForTests } from "./data";

// Zdjęcia dziennika chronione przed odśmiecaniem (Etap 5 § 5.6): dawny zapis z localStorage też się liczy.
const REF = "a".repeat(64);
const OTHER = "b".repeat(64);

describe("journalImageRefs", () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 14, 12));
    await yjsStore.resetForTests();
    resetStudyForTests();
  });

  it("bez wpisów zwraca pusty zbiór", () => {
    expect(journalImageRefs().size).toBe(0);
  });

  it("dawny zapis z localStorage: liczą się tylko poprawne referencje zdjęć", () => {
    localStorage.setItem(STUDY_STORAGE_KEY, JSON.stringify({
      journal: [{ id: "e", images: [REF, "nie-zdjecie"] }, { id: "f", images: [OTHER] }],
    }));
    const refs = journalImageRefs();
    expect(refs.has(REF)).toBe(true);
    expect(refs.has(OTHER)).toBe(true);
    expect(refs.has("nie-zdjecie")).toBe(false);
  });

  it("uszkodzony zapis nie wywala listy", () => {
    localStorage.setItem(STUDY_STORAGE_KEY, "{to nie jest json");
    expect(() => journalImageRefs()).not.toThrow();
  });
});
