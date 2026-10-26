import { describe, expect, it } from "vitest";
import { groupSidebarItems, sidebarItems } from "./sidebarItems";

const counts = { inbox: 0, overdue: 0, trash: 0 };

describe("grupy paska bocznego (PW-4)", () => {
  it("Codziennie, Praca, Osobiste, a Archiwum i Kosz na dole bez nagłówka", () => {
    const groups = groupSidebarItems(sidebarItems(counts));
    expect(groups.map((g) => [g.key, g.label])).toEqual([
      ["codziennie", "Codziennie"],
      ["praca", "Praca"],
      ["osobiste", "Osobiste"],
      ["archiwum", ""],
    ]);
    expect(groups[0].items.map((i) => i.label)).toEqual(["Notatki", "Skrzynka", "Dziś", "Terminy", "Kalendarz"]);
    expect(groups[1].items.map((i) => i.label)).toEqual(["Grafik", "Praca"]);
    expect(groups[2].items.map((i) => i.label)).toEqual(["Długi", "Ćwiczenia"]);
    expect(groups[3].items.map((i) => i.label)).toEqual(["Archiwum", "Kosz"]);
  });

  it("każdy dział jest dokładnie w jednej grupie", () => {
    const items = sidebarItems(counts);
    const grouped = groupSidebarItems(items).flatMap((g) => g.items);
    expect(grouped.length).toBe(items.length);
  });
});
