import { describe, expect, it } from "vitest";
import { addJournalEntry, updateJournalEntry } from "./journalActions";
import { getStudy } from "./store";

// W5: `added` = moment zapisu; cofnięcie daty wpisu go nie zmienia.
describe("JournalEntry.added", () => {
  it("jest ustawiane przy zapisie i zostaje przy edycji (także po cofnięciu daty)", () => {
    const now = Date.UTC(2026, 10, 11, 12);
    const e = addJournalEntry({ kind: "ok", topic: null, text: "montaż", site: "Dom Nowak", at: now - 3 * 86_400_000 }, now)!;
    expect(e.at).toBe(now - 3 * 86_400_000);
    expect(e.added).toBe(now);
    const later = now + 5000;
    updateJournalEntry(e.id, { kind: "ok", topic: null, text: "montaż 2", site: "Dom Nowak", at: now - 4 * 86_400_000, resolved: null }, later);
    const saved = getStudy().journal.find((x) => x.id === e.id)!;
    expect(saved.text).toBe("montaż 2");
    expect(saved.added).toBe(now);
  });
});

describe("cleanEntry — zakres czasu (W17)", () => {
  const base = { id: "x", kind: "ok", topic: null, text: "t", site: "S", checked: [], images: [] };
  it("odcina śmieciowe znaczniki, nie odrzuca wpisu z lekko przesuniętym zegarem", async () => {
    const { cleanEntry } = await import("./journalEntry");
    expect(cleanEntry({ ...base, at: 9e15 })).toBeNull();
    expect(cleanEntry({ ...base, at: -5 })).toBeNull();
    expect(cleanEntry({ ...base, at: Date.now() + 30 * 86_400_000 })).not.toBeNull(); // zegar do przodu o miesiąc
    const e = cleanEntry({ ...base, kind: "problem", at: 1000, resolved: 9e15 });
    expect(e).not.toBeNull();
    expect(e).not.toHaveProperty("resolved");
  });
});
