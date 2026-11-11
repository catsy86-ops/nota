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
