import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { legacyStudyMerged, resetStudyForTests, studyDevice, studyReady, useStudyReady, yStudy } from "./data";
import { STUDY_STORAGE_KEY } from "./keys";
import { getDiagEntries, clearDiagForTests } from "@/lib/diagnostics";
import { yjsStore } from "@/lib/yjsStore";
import { dumpFromLegacy } from "./studyDump";
import { renderHook } from "@testing-library/react";

const LEGACY = {
  rounds: 2, bestPercent: 70, lastDay: "2026-10-14", streak: 1,
  journal: [{ id: "old1", at: 1_700_000_000_000, kind: "ok", topic: null, text: "Stary wpis", site: "Lipowa", checked: [], images: [] }],
};

async function fresh() {
  localStorage.clear();
  clearDiagForTests();
  await yjsStore.resetForTests();
  resetStudyForTests();
}

beforeEach(fresh);
afterEach(() => vi.restoreAllMocks());

describe("studyDevice", () => {
  it("jest stałe między wywołaniami i zapisane w localStorage", () => {
    const a = studyDevice();
    expect(a).toMatch(/^dev-[0-9a-f]{12}$/);
    expect(studyDevice()).toBe(a);
    expect(localStorage.getItem(`${STUDY_STORAGE_KEY}.device`)).toBe(a);
  });

  it("bez localStorage trzyma id w pamięci", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const a = studyDevice();
    expect(a).toMatch(/^dev-/);
    expect(studyDevice()).toBe(a);
  });
});

describe("migracja ze starego zapisu", () => {
  it("przenosi dziennik do Yjs raz i zostawia stary klucz jako kopię", async () => {
    localStorage.setItem(STUDY_STORAGE_KEY, JSON.stringify(LEGACY));
    expect(legacyStudyMerged()).toBe(false);
    await studyReady();
    expect(yStudy.get().journal.map((e) => e.id)).toContain("old1");
    expect(legacyStudyMerged()).toBe(true);
    expect(localStorage.getItem(STUDY_STORAGE_KEY)).not.toBeNull();
    expect(getDiagEntries().some((e) => e.source === "study" && e.message.includes("przeniesiona"))).toBe(true);
  });

  it("drugi start nie dubluje wpisów", async () => {
    localStorage.setItem(STUDY_STORAGE_KEY, JSON.stringify(LEGACY));
    await studyReady();
    resetStudyForTests();
    await studyReady();
    expect(yStudy.get().journal.filter((e) => e.id === "old1")).toHaveLength(1);
  });

  it("uszkodzony JSON: nic nie scala i zostaje ślad w diagnostyce", async () => {
    localStorage.setItem(STUDY_STORAGE_KEY, "{nie json");
    await studyReady();
    expect(yStudy.get().journal).toHaveLength(0);
    expect(legacyStudyMerged()).toBe(false);
    expect(getDiagEntries().some((e) => e.level === "error" && e.message.includes("uszkodzony stary zapis"))).toBe(true);
    expect(localStorage.getItem(STUDY_STORAGE_KEY)).toBe("{nie json");
  });

  it("brak starego zapisu: nic się nie dzieje", async () => {
    await studyReady();
    expect(yStudy.get().journal).toHaveLength(0);
    expect(legacyStudyMerged()).toBe(false);
  });

  it("zapis o złym kształcie nie przewraca startu", async () => {
    localStorage.setItem(STUDY_STORAGE_KEY, JSON.stringify([1, "x", null]));
    await expect(studyReady()).resolves.toBeUndefined();
    expect(yStudy.get().journal).toHaveLength(0);
  });
});

describe("legacyStudyMerged", () => {
  it("błąd odczytu znacznika daje false i ślad w diagnostyce", () => {
    vi.spyOn(yStudy, "isMerged").mockImplementation(() => { throw new Error("boom"); });
    expect(legacyStudyMerged()).toBe(false);
    expect(getDiagEntries().some((e) => e.level === "warn" && e.message.includes("błąd scalania"))).toBe(true);
  });
});

describe("useStudyReady", () => {
  it("po wczytaniu dokumentu mówi prawdę", async () => {
    await studyReady();
    const { result } = renderHook(() => useStudyReady());
    expect(result.current).toBe(true);
  });
});

describe("migracja — przypadki brzegowe (Z-12)", () => {
  it("ten sam stary zapis pod innym id urządzenia (setItem odrzucany) nie dubluje wpisów", async () => {
    localStorage.setItem(STUDY_STORAGE_KEY, JSON.stringify(LEGACY));
    await studyReady();
    // „Nowy start” z innym id urządzenia, bo identyfikatora nie dało się zapisać.
    yStudy.mergeIn(dumpFromLegacy(LEGACY, "dev-inny00000001"), "dev-inny00000001");
    expect(yStudy.get().journal.filter((e) => e.id === "old1")).toHaveLength(1);
  });

  it("uszkodzony JSON przy kolejnych startach nie zapętla się i nie zmienia klucza", async () => {
    localStorage.setItem(STUDY_STORAGE_KEY, "{nie json");
    await studyReady();
    resetStudyForTests();
    await studyReady();
    expect(localStorage.getItem(STUDY_STORAGE_KEY)).toBe("{nie json");
    expect(yStudy.get().journal).toHaveLength(0);
    expect(getDiagEntries().filter((e) => e.message.includes("uszkodzony stary zapis"))).toHaveLength(2);
  });

  it("dwa urządzenia ze starymi zapisami: kolejność scalania nie zmienia wyniku", async () => {
    const A = { ...LEGACY, journal: [{ ...LEGACY.journal[0], id: "a1" }] };
    const B = { ...LEGACY, journal: [{ ...LEGACY.journal[0], id: "b1" }] };
    const ids = async (order: [unknown, string][]) => {
      await yjsStore.resetForTests();
      for (const [d, dev] of order) yStudy.mergeIn(dumpFromLegacy(d, dev), dev);
      return yStudy.get().journal.map((e) => e.id).sort();
    };
    const ab = await ids([[A, "dev-aaaaaaaaaaaa"], [B, "dev-bbbbbbbbbbbb"]]);
    const ba = await ids([[B, "dev-bbbbbbbbbbbb"], [A, "dev-aaaaaaaaaaaa"]]);
    expect(ab).toEqual(["a1", "b1"]);
    expect(ba).toEqual(ab);
  });

  it("studyReady() wołane wiele razy migruje raz", async () => {
    localStorage.setItem(STUDY_STORAGE_KEY, JSON.stringify(LEGACY));
    const spy = vi.spyOn(yStudy, "mergeIn");
    await Promise.all([studyReady(), studyReady(), studyReady()]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("wyjątek z mergeIn nie blokuje gotowości widoku", async () => {
    localStorage.setItem(STUDY_STORAGE_KEY, JSON.stringify(LEGACY));
    vi.spyOn(yStudy, "mergeIn").mockImplementation(() => { throw new Error("boom"); });
    await expect(studyReady()).resolves.toBeUndefined();
    const { result } = renderHook(() => useStudyReady());
    expect(result.current).toBe(true);
    expect(getDiagEntries().some((e) => e.level === "error" && e.message.includes("migracja Nauki nie powiodła się"))).toBe(true);
  });
});
