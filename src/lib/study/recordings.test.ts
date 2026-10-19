import { describe, it, expect } from "vitest";
import { cleanEntry, cleanRecordings, JOURNAL_MAX_RECORDINGS } from "./yStudy";
import { journalRefsIn, recordingRefsIn } from "./journalRefs";
import { addRecording } from "./recordings";

// Klucze w `imageStore` to 64 znaki hex (SHA-256).
const H1 = "a".repeat(64);
const H2 = "b".repeat(64);
const H3 = "c".repeat(64);
const H4 = "d".repeat(64);
const MB = 1024 * 1024;

const rec = (hash: string, over: Partial<{ name: string; size: number; type: string }> = {}) => ({
  hash, name: "nagranie.webm", size: 300_000, type: "audio/webm", ...over,
});

describe("cleanRecordings — nagrania wpisu", () => {
  it("zostawia poprawne manifesty audio", () => {
    expect(cleanRecordings([rec(H1)])).toEqual([{ hash: H1, name: "nagranie.webm", size: 300_000, type: "audio/webm" }]);
  });

  it("odrzuca zdjęcia, złe klucze i rozmiary", () => {
    const out = cleanRecordings([
      rec(H1, { type: "image/jpeg" }),
      rec("nie-hash"),
      rec(H2, { size: 0 }),
      rec(H3, { size: Number.NaN }),
      rec(H4),
    ]);
    expect(out.map((r) => r.hash)).toEqual([H4]);
  });

  it("ogranicza liczbę nagrań w wpisie", () => {
    const many = Array.from({ length: JOURNAL_MAX_RECORDINGS + 2 }, (_, i) => rec(String(i).padStart(64, "e")));
    expect(cleanRecordings(many)).toHaveLength(JOURNAL_MAX_RECORDINGS);
  });

  it("śmieci zamiast listy dają pustą listę", () => {
    expect(cleanRecordings("x")).toEqual([]);
    expect(cleanRecordings(undefined)).toEqual([]);
  });
});

describe("wpis z samym nagraniem", () => {
  it("nie jest pusty i zachowuje nagranie", () => {
    const entry = cleanEntry({ id: "e1", at: 1, kind: "note", text: "", recordings: [rec(H1)] });
    expect(entry).not.toBeNull();
    expect(entry?.recordings).toHaveLength(1);
  });

  it("bez tekstu, zdjęć i nagrań nadal jest pusty", () => {
    expect(cleanEntry({ id: "e1", at: 1, kind: "note", text: "", recordings: [] })).toBeNull();
  });
});

/** Dokument Yjs w kształcie `getMap` — wystarczy do zbierania referencji. */
function docWith(entries: Record<string, unknown>) {
  const journal = new Map(Object.entries(entries));
  return { getMap: (name: string) => (name === "studyJournal" ? journal : new Map()) };
}

describe("journalRefsIn — nagrania w kopii i synchronizacji", () => {
  it("nagrania są wśród kluczy magazynu obok zdjęć", () => {
    const doc = docWith({ e1: { images: [H1], recordings: [rec(H2)] } });
    expect([...journalRefsIn(doc)].sort()).toEqual([H1, H2].sort());
  });

  it("do innego urządzenia jadą nagrania do 2 MB, większe zostają lokalnie", () => {
    const doc = docWith({
      e1: { images: [], recordings: [rec(H2, { size: 1 * MB }), rec(H3, { size: 3 * MB })] },
    });
    expect([...journalRefsIn(doc, true)]).toEqual([H2]);
    expect(journalRefsIn(doc).size).toBe(2);
  });
});

describe("addRecording — limit nagrań w wpisie", () => {
  it("przy pełnym wpisie odrzuca nagranie bez zapisu", async () => {
    const current = [rec(H1), rec(H2), rec(H3)];
    const res = await addRecording(new File(["x"], "n.webm", { type: "audio/webm" }), current);
    expect(res.added).toBeNull();
    expect(res.message).toMatch(/najwyżej 3 nagrania/);
  });
});

describe("recordingRefsIn — klucze nagrań dla raportu kopii", () => {
  it("zwraca tylko nagrania, bez zdjęć wpisu", () => {
    const doc = docWith({ e1: { images: [H1], recordings: [rec(H2)] } });
    expect([...recordingRefsIn(doc)]).toEqual([H2]);
  });
});
