import { describe, expect, it } from "vitest";
import { addStage, cleanStages, DEFAULT_STAGES, matchStage, removeStage, siteStages, stageProgress, STAGES_MAX, toggleStage } from "./stages";
import { cleanSite } from "./sites";

describe("etapy budowy", () => {
  it("karta bez listy dostaje domyślne etapy domku (kopię, nie oryginał)", () => {
    const list = siteStages({});
    expect(list.map((s) => s.name)).toEqual(DEFAULT_STAGES.map((s) => s.name));
    list[0].done = 1;
    expect(DEFAULT_STAGES[0].done).toBeUndefined();
  });

  it("odhaczenie zapisuje datę, drugie cofa; postęp i następny etap", () => {
    const a = toggleStage(siteStages(null), "kan-pod", 100);
    expect(a.find((s) => s.id === "kan-pod")?.done).toBe(100);
    expect(stageProgress(a)).toMatchObject({ done: 1, total: 7, next: { id: "woda" } });
    const b = toggleStage(a, "kan-pod", 200);
    expect(b.find((s) => s.id === "kan-pod")).toEqual({ id: "kan-pod", name: "Kanalizacja podposadzkowa" });
  });

  it("wszystko zrobione — brak następnego", () => {
    const all = DEFAULT_STAGES.reduce((l, s) => toggleStage(l, s.id, 1), siteStages(null));
    expect(stageProgress(all)).toEqual({ done: 7, total: 7, next: null });
  });

  it("własny etap na końcu; pusta nazwa i duplikat (bez wielkości liter) — bez zmian", () => {
    const base = siteStages(null);
    const added = addStage(base, "  Kocioł   i grzejniki ", () => "s-1");
    expect(added[added.length - 1]).toEqual({ id: "s-1", name: "Kocioł i grzejniki" });
    expect(addStage(added, "   ")).toHaveLength(added.length);
    expect(addStage(added, "próba SZCZELNOŚCI")).toHaveLength(added.length);
  });

  it("limit etapów", () => {
    let list = siteStages(null);
    for (let i = 0; i < 30; i++) list = addStage(list, `Etap ${i}`);
    expect(list).toHaveLength(STAGES_MAX);
  });

  it("usunięcie etapu", () => {
    expect(removeStage(siteStages(null), "odbior").map((s) => s.id)).not.toContain("odbior");
  });

  it("cleanStages: odrzuca śmieci i duplikaty id, zachowuje datę; nie-tablica = brak listy", () => {
    expect(cleanStages("x")).toBeUndefined();
    expect(cleanStages([
      { id: "a", name: " Woda ", done: 5 },
      { id: "a", name: "Duplikat" },
      { id: "", name: "Bez id" },
      { id: "b", name: "" },
      { id: "c", name: "Kanalizacja", done: "wczoraj" },
      null,
    ])).toEqual([{ id: "a", name: "Woda", done: 5 }, { id: "c", name: "Kanalizacja" }]);
  });

  it("cleanSite zachowuje etapy karty, a bez nich nie dopisuje pola", () => {
    const base = { id: "k1", name: "Dom", address: "", investor: "", created: 1 };
    expect(cleanSite({ ...base, stages: [{ id: "woda", name: "Woda", done: 3 }] })?.stages).toEqual([{ id: "woda", name: "Woda", done: 3 }]);
    expect(cleanSite(base)).not.toHaveProperty("stages");
  });
});

describe("matchStage — etap z wypowiedzi", () => {
  const list = siteStages(null);
  it("dokładnie, po początku i po słowach (bez ogonków)", () => {
    expect(matchStage(list, "Próba szczelności")?.id).toBe("proba");
    expect(matchStage(list, "bialy montaz")?.id).toBe("bialy");
    expect(matchStage(list, "odbiór")?.id).toBe("odbior");
    expect(matchStage(list, "rozprowadzenie")?.id).toBe("woda");
    expect(matchStage(list, "piony")?.id).toBe("kan-pion");
  });
  it("niejednoznaczne albo nieznane — null", () => {
    // „kanalizacja” zaczyna tylko „Kanalizacja podposadzkowa” (drugi etap ma „kanalizacji”).
    expect(matchStage(list, "kanalizacja")?.id).toBe("kan-pod");
    const two = [...list, { id: "g1", name: "Grzejniki parter" }, { id: "g2", name: "Grzejniki piętro" }];
    expect(matchStage(two, "grzejniki")).toBeNull();
    expect(matchStage(two, "grzejniki pietro")?.id).toBe("g2");
    expect(matchStage(list, "kocioł")).toBeNull();
    expect(matchStage(list, "  ")).toBeNull();
  });
});
