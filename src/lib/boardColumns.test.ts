import { describe, expect, it } from "vitest";
import { columnDropId, columnKeyFromDropId, columnOfNote, labelsForColumn, NONE_COLUMN, PINNED_COLUMN } from "@/lib/boardColumns";

describe("boardColumns", () => {
  it("rozpoznaje identyfikator strefy kolumny i nie myli go z id notatki", () => {
    expect(columnKeyFromDropId(columnDropId("praca"))).toBe("praca");
    expect(columnKeyFromDropId("a1b2c3")).toBeNull();
  });

  it("kolumna notatki zgodna z podziałem: przypięte, pierwsza etykieta, folder, brak", () => {
    const n = { pinned: false, labels: ["a", "b"], folderId: "f1" };
    expect(columnOfNote(n, "label")).toBe("a");
    expect(columnOfNote(n, "folder")).toBe("f1");
    expect(columnOfNote({ ...n, labels: [], folderId: null }, "label")).toBe(NONE_COLUMN);
    expect(columnOfNote({ ...n, pinned: true }, "label")).toBe(PINNED_COLUMN);
    expect(columnOfNote(n, "date")).toBeUndefined();
  });

  it("etykieta docelowa wskakuje na początek, „bez etykiety” czyści", () => {
    expect(labelsForColumn(["a", "b"], "b")).toEqual(["b", "a"]);
    expect(labelsForColumn(["a"], "c")).toEqual(["c", "a"]);
    expect(labelsForColumn(["a", "b"], NONE_COLUMN)).toEqual([]);
  });
});
