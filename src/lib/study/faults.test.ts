import { describe, expect, it } from "vitest";
import { daysToDue, faultStatus, openFaults } from "./faults";
import { cleanEntry, type JournalEntry } from "./yStudy";

const e = (id: string, extra: Partial<JournalEntry> = {}): JournalEntry =>
  ({ id, at: Number(id.replace(/\D/g, "")) || 1, kind: "problem", topic: null, text: "usterka", site: "Lipowa 5", siteId: "lipowa", checked: [], images: [], ...extra }) as JournalEntry;

describe("usterki (P2.3)", () => {
  it("otwarte: tylko nierozwiązane problemy tej budowy, od najstarszej", () => {
    const journal = [
      e("p2", { at: 20 }),
      e("p1", { at: 10 }),
      e("done", { at: 5, resolved: 99 }),
      e("other", { at: 1, siteId: "inna", site: "Inna" }),
      { ...e("ok", { at: 3 }), kind: "ok" } as JournalEntry,
    ];
    expect(openFaults(journal, "lipowa").map((x) => x.id)).toEqual(["p1", "p2"]);
  });

  it("status: bez terminu, w terminie, po terminie", () => {
    expect(faultStatus({}, "2026-10-28")).toBe("no-date");
    expect(faultStatus({ due: "2026-10-30" }, "2026-10-28")).toBe("open");
    expect(faultStatus({ due: "2026-10-28" }, "2026-10-28")).toBe("open");
    expect(faultStatus({ due: "2026-10-27" }, "2026-10-28")).toBe("overdue");
  });

  it("dni do terminu, także przez zmianę miesiąca", () => {
    expect(daysToDue("2026-11-02", "2026-10-28")).toBe(5);
    expect(daysToDue("2026-10-25", "2026-10-28")).toBe(-3);
    expect(daysToDue(undefined, "2026-10-28")).toBeNull();
  });
});

describe("zapis pól usterki (P2.3)", () => {
  it("cleanEntry zachowuje odpowiedzialnego, termin i zdjęcia po naprawie tylko dla problemu", () => {
    const raw = { id: "p1", at: 1, kind: "problem", topic: null, text: "x", site: "s", images: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"], owner: "  Marek  ", due: "2026-11-02", after: ["bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"] };
    const clean = cleanEntry(raw)!;
    expect(clean.owner).toBe("Marek");
    expect(clean.due).toBe("2026-11-02");
    expect(clean.after).toEqual(["bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"]);
    const ok = cleanEntry({ ...raw, id: "o1", kind: "ok", owner: "Marek", due: "2026-11-02" })!;
    expect(ok.owner).toBeUndefined();
    expect(ok.due).toBeUndefined();
  });

  it("zły termin i pusty odpowiedzialny są odrzucane", () => {
    const clean = cleanEntry({ id: "p2", at: 1, kind: "problem", topic: null, text: "x", site: "s", images: [], owner: "   ", due: "jutro" })!;
    expect(clean.owner).toBeUndefined();
    expect(clean.due).toBeUndefined();
  });
});
