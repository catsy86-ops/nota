import { describe, it, expect } from "vitest";
import { filterTriageChips, hasExact, rankTriageChips, triageQuery, type TriageChip } from "./triageChips";

const chips: TriageChip[] = [
  { kind: "folder", id: "f1", label: "Dom" },
  { kind: "folder", id: "f2", label: "Budowa Lipowa" },
  { kind: "label", label: "łazienka" },
  { kind: "label", label: "zakupy" },
];

describe("chipy porządkowania", () => {
  it("najczęściej używane najpierw, remis zostawia kolejność (foldery przed etykietami)", () => {
    const notes = [
      { folderId: "f2", labels: ["zakupy"] },
      { folderId: "f2", labels: ["zakupy"] },
      { folderId: null, labels: ["zakupy"] },
      { folderId: "f1", labels: [] },
    ];
    expect(rankTriageChips(chips, notes).map((c) => c.label)).toEqual(["zakupy", "Budowa Lipowa", "Dom", "łazienka"]);
    expect(rankTriageChips(chips, []).map((c) => c.label)).toEqual(["Dom", "Budowa Lipowa", "łazienka", "zakupy"]);
  });

  it("filtr bez ogonków i wielkości liter, najpierw początek nazwy, `#`/`@` pomijane", () => {
    expect(filterTriageChips(chips, "LAZ").map((c) => c.label)).toEqual(["łazienka"]);
    expect(filterTriageChips(chips, "#zak").map((c) => c.label)).toEqual(["zakupy"]);
    expect(filterTriageChips(chips, "lipowa").map((c) => c.label)).toEqual(["Budowa Lipowa"]);
    expect(filterTriageChips(chips, "bu").map((c) => c.label)).toEqual(["Budowa Lipowa"]);
    expect(filterTriageChips(chips, "  ")).toHaveLength(4);
  });

  it("dokładna nazwa danego rodzaju blokuje „Nowy…” tylko dla tego rodzaju", () => {
    expect(hasExact(chips, "dom", "folder")).toBe(true);
    expect(hasExact(chips, "dom", "label")).toBe(false);
    expect(hasExact(chips, "#Łazienka", "label")).toBe(true);
    expect(triageQuery("  @Dom ")).toBe("Dom");
  });
});
