import { describe, expect, it } from "vitest";
import { groupSidebarItems, sidebarItems } from "./sidebarItems";
import { VIEW_GROUP } from "@/lib/viewMeta";

const counts = { inbox: 0, overdue: 0, trash: 0 };

describe("grupy paska bocznego (PW-4)", () => {
  it("Codziennie, Praca, Osobiste; Archiwum i Kosz na końcu Osobistych (NP-4, plan 3.7)", () => {
    const groups = groupSidebarItems(sidebarItems(counts));
    expect(groups.map((g) => [g.key, g.label])).toEqual([
      ["codziennie", "Codziennie"],
      ["praca", "Praca"],
      ["osobiste", "Osobiste"],
    ]);
    expect(groups[0].items.map((i) => i.label)).toEqual(["Notatki", "Skrzynka", "Dziś", "Terminy", "Kalendarz"]);
    expect(groups[1].items.map((i) => i.label)).toEqual(["Grafik", "Praca"]); // Plany są zakładką Pracy (2026-11-05).
    expect(groups[2].items.map((i) => i.label)).toEqual(["Długi", "Ćwiczenia", "Archiwum", "Kosz"]);
  });

  it("każdy dział jest dokładnie w jednej grupie", () => {
    const items = sidebarItems(counts);
    const grouped = groupSidebarItems(items).flatMap((g) => g.items);
    expect(grouped.length).toBe(items.length);
  });

  it("grupa w pasku = grupa w główce kartki (VIEW_GROUP)", () => {
    // Archiwum i Kosz są w pasku w Osobistych, a w główce bez linijki grupy (viewMeta) — świadomie różne.
    for (const item of sidebarItems(counts)) {
      if (item.view === "archive" || item.view === "trash") continue;
      expect(item.group).toBe(VIEW_GROUP[item.view]);
    }
  });
});
