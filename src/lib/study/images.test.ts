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

  it("nagrania szkicu są chronione przed odśmiecaniem (W9)", async () => {
    const { JOURNAL_DRAFT_KEY } = await import("./keys");
    localStorage.setItem(JOURNAL_DRAFT_KEY, JSON.stringify({ text: "", images: [], recordings: [{ hash: REF, name: "n.m4a", size: 10, type: "audio/mp4" }] }));
    expect(journalImageRefs().has(REF)).toBe(true);
  });

  it("nagrania i zdjęcia otwartej edycji też", async () => {
    const { openJournalEdit, closeJournalSheet } = await import("./entrySheet");
    openJournalEdit({ id: "x", at: 1, kind: "ok", topic: null, text: "t", site: "S", checked: [], images: [OTHER], recordings: [{ hash: REF, name: "n.m4a", size: 10, type: "audio/mp4" }] });
    const refs = journalImageRefs();
    closeJournalSheet();
    expect(refs.has(REF)).toBe(true);
    expect(refs.has(OTHER)).toBe(true);
  });
});

