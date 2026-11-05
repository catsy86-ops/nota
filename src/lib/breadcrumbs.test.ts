import { describe, expect, it } from "vitest";
import { folderCrumbs, labelCrumbs } from "./breadcrumbs";

const folders = [
  { id: "a", name: "Dom", parentId: null },
  { id: "b", name: "Remont", parentId: "a" },
  { id: "c", name: "Łazienka", parentId: "b" },
];

describe("okruszki", () => {
  it("folder: przodkowie od korzenia, bez bieżącego", () => {
    expect(folderCrumbs(folders, "c").map((c) => c.label)).toEqual(["Dom", "Remont"]);
    expect(folderCrumbs(folders, "a")).toEqual([]);
    expect(folderCrumbs(folders, null)).toEqual([]);
  });

  it("folder: pętla w danych się kończy", () => {
    const loop = [{ id: "x", name: "X", parentId: "y" }, { id: "y", name: "Y", parentId: "x" }];
    expect(folderCrumbs(loop, "x").map((c) => c.label)).toEqual(["X", "Y"]);
  });

  it("etykieta zagnieżdżona: rodzice ze ścieżką", () => {
    expect(labelCrumbs("budowa/łazienka/płytki")).toEqual([
      { label: "#budowa", target: { kind: "label", label: "budowa" } },
      { label: "#łazienka", target: { kind: "label", label: "budowa/łazienka" } },
    ]);
    expect(labelCrumbs("dom")).toEqual([]);
  });
});
