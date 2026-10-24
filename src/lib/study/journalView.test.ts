import { describe, expect, it } from "vitest";
import type { JournalEntry } from "./yStudy";
import { entryHeadline, recentSiteTexts, yesterdaySiteText } from "./journalView";
import { siteKey } from "./sites";

const day = (d: number, h = 12) => new Date(2026, 9, d, h).getTime();
const entry = (id: string, at: number, text: string, site = "Dom Kowalski", siteId?: string): JournalEntry => ({
  id, at, kind: "ok", topic: null, text, site, siteId, checked: [], images: [],
});

const NOW = day(16, 9);
const journal: JournalEntry[] = [
  entry("a", day(14), "Montaż pionu", "Dom Kowalski", "s1"),
  entry("b", day(15, 8), "Próba wody OK", "Dom Kowalski", "s1"),
  entry("c", day(15, 17), "Montaż pionu", "Dom Kowalski", "s1"),
  entry("d", day(15, 18), "Inna budowa", "Hala", "s2"),
  entry("e", day(15, 19), "  ", "Dom Kowalski", "s1"),
  // Wpis sprzed kart: budowa z nazwy, id = siteKey(nazwa).
  entry("f", day(15, 20), "Stara nazwa bez karty", "Dom Kowalski"),
];

describe("recentSiteTexts", () => {
  it("zwraca różne teksty z tej budowy, od najnowszego, bez pustych", () => {
    expect(recentSiteTexts(journal, "s1")).toEqual(["Montaż pionu", "Próba wody OK"]);
    expect(recentSiteTexts(journal, siteKey("Dom Kowalski"))).toEqual(["Stara nazwa bez karty"]);
  });

  it("obcina do limitu", () => {
    expect(recentSiteTexts(journal, "s1", 1)).toEqual(["Montaż pionu"]);
  });

  it("bez id budowy nie ma podpowiedzi", () => {
    expect(recentSiteTexts(journal, "")).toEqual([]);
  });
});

describe("yesterdaySiteText", () => {
  it("bierze najnowszy wpis z poprzedniego dnia na tej budowie", () => {
    expect(yesterdaySiteText(journal, "s1", NOW)).toBe("Montaż pionu");
    expect(yesterdaySiteText(journal, siteKey("Dom Kowalski"), NOW)).toBe("Stara nazwa bez karty");
  });

  it("pomija dzisiejsze i sprzed dwóch dni", () => {
    const j = [entry("x", day(16, 8), "dziś"), entry("y", day(14, 23), "przedwczoraj")];
    expect(yesterdaySiteText(j, "s1", NOW)).toBeNull();
  });

  it("pomija inne budowy i puste teksty", () => {
    expect(yesterdaySiteText([entry("z", day(15), "  "), entry("w", day(15), "Hala", "Hala", "s2")], "s1", NOW)).toBeNull();
  });

  it("bez id budowy → null", () => {
    expect(yesterdaySiteText(journal, "", NOW)).toBeNull();
  });
});

describe("entryHeadline", () => {
  const base = { text: "", checked: [] as string[], images: [] as string[] };
  it("tekst wygrywa; bez tekstu kolejno próba, kształtki, lista, nagranie, zdjęcie, „Wpis”", () => {
    expect(entryHeadline({ ...base, text: "  Pion  " })).toBe("Pion");
    expect(entryHeadline({ ...base, test: { medium: "air", bar: 6, minutes: 30, drop: 0, ok: true }, checked: ["x"] })).toBe("Próba szczelności");
    expect(entryHeadline({ ...base, fittings: [{ kind: "kolano", count: 1 }] as unknown as JournalEntry["fittings"] })).toBe("Kształtki");
    expect(entryHeadline({ ...base, checked: ["x"], images: ["a"] })).toBe("Sprawdzone punkty listy");
    expect(entryHeadline({ ...base, recordings: ["r"], images: ["a"] } as unknown as Parameters<typeof entryHeadline>[0])).toBe("Nagranie");
    expect(entryHeadline({ ...base, images: ["a"] })).toBe("Zdjęcie");
    expect(entryHeadline(base)).toBe("Wpis");
  });
});
