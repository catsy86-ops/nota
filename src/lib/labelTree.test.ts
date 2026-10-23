import { describe, it, expect } from "vitest";
import {
  cleanLabelPath, labelDepth, parentLabel, isUnderLabel, noteMatchesLabel, renameLabelBranch, buildLabelRows, LABEL_MAX_DEPTH,
} from "./labelTree";

describe("cleanLabelPath", () => {
  it("przycina segmenty i usuwa puste", () => {
    expect(cleanLabelPath(" budowa / łazienka ")).toBe("budowa/łazienka");
    expect(cleanLabelPath("a//b")).toBe("a/b");
    expect(cleanLabelPath("/a/")).toBe("a");
    expect(cleanLabelPath("   ")).toBe("");
  });

  it("ogranicza głębokość", () => {
    const deep = Array.from({ length: LABEL_MAX_DEPTH + 3 }, (_, i) => `s${i}`).join("/");
    expect(labelDepth(cleanLabelPath(deep))).toBe(LABEL_MAX_DEPTH);
  });
});

describe("hierarchia", () => {
  it("głębokość i rodzic", () => {
    expect(labelDepth("budowa")).toBe(1);
    expect(labelDepth("budowa/łazienka")).toBe(2);
    expect(parentLabel("budowa/łazienka")).toBe("budowa");
    expect(parentLabel("budowa")).toBeNull();
  });

  it("poddrzewo: ta sama nazwa i dzieci, ale nie prefiks innego słowa", () => {
    expect(isUnderLabel("budowa/łazienka", "budowa")).toBe(true);
    expect(isUnderLabel("budowa", "budowa")).toBe(true);
    expect(isUnderLabel("budowana", "budowa")).toBe(false);
  });

  it("filtr po rodzicu obejmuje dzieci", () => {
    expect(noteMatchesLabel(["budowa/łazienka"], "budowa")).toBe(true);
    expect(noteMatchesLabel(["budowa/łazienka"], "budowa/łazienka")).toBe(true);
    expect(noteMatchesLabel(["budowa/łazienka"], "budowa/kuchnia")).toBe(false);
    expect(noteMatchesLabel([], "budowa")).toBe(false);
  });
});

describe("renameLabelBranch", () => {
  it("przepina gałąź i całe poddrzewo, resztę zostawia", () => {
    const out = renameLabelBranch(["budowa", "budowa/łazienka", "budowana", "dom"], "budowa", "dom/remont");
    expect(out).toEqual(["dom/remont", "dom/remont/łazienka", "budowana", "dom"]);
  });

  it("bez duplikatów, gdy nowa nazwa już istnieje", () => {
    expect(renameLabelBranch(["a", "b"], "a", "b")).toEqual(["b"]);
  });
});

describe("buildLabelRows", () => {
  it("rodzic przed dziećmi, dzieci nie mieszają się z rodzeństwem", () => {
    const rows = buildLabelRows(["ab", "a/c", "a/b", "a/b/x"]);
    expect(rows.map((r) => r.label)).toEqual(["a", "a/b", "a/b/x", "a/c", "ab"]);
  });

  it("ma głębokość, nazwę wyświetlaną i znacznik dzieci", () => {
    const rows = buildLabelRows(["budowa/łazienka"]);
    expect(rows).toEqual([
      { label: "budowa", depth: 1, name: "budowa", hasChildren: true },
      { label: "budowa/łazienka", depth: 2, name: "łazienka", hasChildren: false },
    ]);
  });
});
