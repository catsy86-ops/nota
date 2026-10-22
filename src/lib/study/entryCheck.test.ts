import { describe, expect, it } from "vitest";
import {
  addCheckItem, checkLine, checkStatus, cleanCheckItems, cleanRecord, DEFAULT_CHECK_ITEMS, enterSite, keepFrom,
  reopenCheck, siteContextItems, toggleCheck, CHECK_ITEMS_MAX,
} from "./entryCheck";
import type { JournalEntry } from "./yStudy";

const entry = (p: Partial<JournalEntry>): JournalEntry => ({
  id: p.id ?? "e1", at: p.at ?? 1, kind: p.kind ?? "note", topic: null, text: p.text ?? "", site: p.site ?? "Lipowa",
  checked: [], images: [], ...p,
}) as JournalEntry;

describe("lista przed wejściem — model", () => {
  it("czyści punkty: puste, duplikaty, punkty z karty i nadmiar odpadają", () => {
    const raw = [
      { id: "a", text: "  Kask  " }, { id: "a", text: "dubel" }, { id: "b", text: "" }, { id: "ctx-braki", text: "x" }, "śmieć",
      ...Array.from({ length: 30 }, (_, i) => ({ id: `k-${i}`, text: `punkt ${i}` })),
    ];
    const out = cleanCheckItems(raw)!;
    expect(out[0]).toEqual({ id: "a", text: "Kask" });
    expect(out).toHaveLength(CHECK_ITEMS_MAX);
    expect(out.some((i) => i.id === "ctx-braki")).toBe(false);
    expect(cleanCheckItems("nie lista")).toBeUndefined();
  });

  it("czyści zapis dnia; zła data albo brak budowy = null", () => {
    expect(cleanRecord({ site: "s1", day: "2026-10-22", done: ["a", "a", 5], at: 7 })).toEqual({ site: "s1", day: "2026-10-22", done: ["a"], at: 7 });
    expect(cleanRecord({ site: "s1", day: "22.10" , done: [] })).toBeNull();
    expect(cleanRecord({ day: "2026-10-22", done: [] })).toBeNull();
  });

  it("odhacza, wchodzi i cofa wejście bez gubienia odhaczeń", () => {
    let r = toggleCheck(undefined, "s1", "2026-10-22", "ochrona");
    r = toggleCheck(r, "s1", "2026-10-22", "rece");
    r = toggleCheck(r, "s1", "2026-10-22", "rece");
    expect(r.done).toEqual(["ochrona"]);
    r = enterSite(r, "s1", "2026-10-22", 1000);
    expect(r.at).toBe(1000);
    expect(toggleCheck(r, "s1", "2026-10-22", "rece").at).toBe(1000);
    expect(reopenCheck(r)).toEqual({ site: "s1", day: "2026-10-22", done: ["ochrona"] });
  });

  it("postęp liczy tylko punkty, które są dziś na liście", () => {
    const items = DEFAULT_CHECK_ITEMS.slice(0, 3);
    const r = { site: "s1", day: "2026-10-22", done: ["ochrona", "usuniety"], at: new Date(2026, 9, 22, 7, 12).getTime() };
    const s = checkStatus(items, r);
    expect(s).toMatchObject({ done: 1, total: 3, entered: true });
    expect(checkLine(s)).toBe("Lista przed wejściem: 1/3, wejście 07:12");
    expect(checkLine(checkStatus(items, undefined))).toBe("Lista przed wejściem: 0/3");
  });

  it("dodaje własny punkt na końcu; pusty tekst nic nie zmienia", () => {
    const items = addCheckItem(DEFAULT_CHECK_ITEMS, "  Klucz do skrzynki ", () => "k-1");
    expect(items.at(-1)).toEqual({ id: "k-1", text: "Klucz do skrzynki" });
    expect(addCheckItem(DEFAULT_CHECK_ITEMS, "   ")).toHaveLength(DEFAULT_CHECK_ITEMS.length);
  });

  it("punkty z karty: dostęp, braki, dostawa na dziś, etap, problemy, serwis", () => {
    const todayEnd = new Date(2026, 9, 22, 23, 59).getTime();
    const items = siteContextItems(
      {
        id: "s1",
        access: "kod do bramy 1234",
        stages: [{ id: "kan-pod", name: "Kanalizacja podposadzkowa", done: 1 }, { id: "woda", name: "Rozprowadzenie wody" }],
        shortages: [
          { id: "a", text: "Klej PCV", qty: "", status: "missing", at: 1 },
          { id: "b", text: "Kolano 16", qty: "10", status: "ordered", at: 2, due: new Date(2026, 9, 22).getTime() },
          { id: "c", text: "Rura 50", qty: "", status: "ordered", at: 3, due: new Date(2026, 9, 25).getTime() },
        ],
        service: [{ id: "v1", text: "Cieknie syfon", at: 1, due: "2026-10-22" }],
      },
      [
        entry({ id: "p1", kind: "problem", text: "Brak spadku na pionie\nszczegóły", siteId: "s1", at: 5 }),
        entry({ id: "p2", kind: "problem", text: "Rozwiązany", siteId: "s1", resolved: 9 }),
        entry({ id: "p3", kind: "problem", text: "Inna budowa", siteId: "s2" }),
      ],
      "2026-10-22",
      todayEnd,
    );
    expect(items.map((i) => i.id)).toEqual(["ctx-dostep", "ctx-braki", "ctx-dostawa", "ctx-etap", "ctx-problemy", "ctx-serwis"]);
    expect(items.find((i) => i.id === "ctx-dostawa")!.text).toContain("Kolano 16");
    expect(items.find((i) => i.id === "ctx-dostawa")!.text).not.toContain("Rura 50");
    expect(items.find((i) => i.id === "ctx-etap")!.text).toBe("Dziś w planie: Rozprowadzenie wody");
    expect(items.find((i) => i.id === "ctx-problemy")!.text).toBe("Otwarty problem: Brak spadku na pionie");
  });

  it("budowa bez zapisanych etapów nie dostaje etapu z listy domyślnej", () => {
    expect(siteContextItems({ id: "s1" }, [], "2026-10-22", 0)).toEqual([]);
  });

  it("granica przechowywania: 120 dni wstecz", () => {
    expect(keepFrom("2026-10-22")).toBe("2026-06-24");
  });
});
