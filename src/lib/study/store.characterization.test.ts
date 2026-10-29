import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getStudy, addJournalEntry, setSite, siteDirectoryOf, saveBoss, saveGroup, setSiteDocs, setSitePlan,
  setSiteService, setSiteWarranty, setSiteRate, recordExam, addCustomQuestion, updateCustomQuestion,
  toggleChecked, resetChecklist, restoreChecklist, dueToday,
} from "./store";
import { findSiteByName } from "./sites";
import { CHECKLIST, TOPICS } from "./content";
import { resetStudyForTests } from "./data";
import { yjsStore } from "@/lib/yjsStore";

// Testy charakteryzujące (spłata długu, Faza 1 / H0.2): przypinają dzisiejsze zachowanie funkcji `store.ts`,
// których nie obejmowały inne testy jednostkowe — przed przeniesieniem ich do osobnych modułów.

async function freshStudy() {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 14, 12));
  await yjsStore.resetForTests();
  resetStudyForTests();
}

/** Budowa „Lipowa 5” z jednym wpisem; zwraca jej id. */
function lipowa(): string {
  setSite("Lipowa 5");
  addJournalEntry({ kind: "note", topic: null, text: "start" }, 1000);
  return findSiteByName(siteDirectoryOf(getStudy()), "Lipowa 5")!.id;
}
const site = (id: string) => siteDirectoryOf(getStudy()).find((s) => s.id === id)!;
const HASH = "a".repeat(64);

beforeEach(freshStudy);

describe("odbiorcy raportu", () => {
  it("saveBoss: pusty numer usuwa, zły numer odrzuca bez zmian, dobry normalizuje", () => {
    expect(saveBoss(" Marek ", "600 100 200")).toBe(true);
    expect(getStudy().boss).toEqual({ name: "Marek", phone: "48600100200" });
    expect(saveBoss("Marek", "12")).toBe(false);
    expect(getStudy().boss?.phone).toBe("48600100200");
    expect(saveBoss("Marek", "  ")).toBe(true);
    expect(getStudy().boss).toBeNull();
  });

  it("saveGroup: pusta nazwa usuwa, link musi być zaproszeniem, bez linku też można", () => {
    expect(saveGroup("Brygada", "evil.com/x")).toBe(false);
    expect(getStudy().group).toBeNull();
    expect(saveGroup(" Brygada ", "")).toBe(true);
    expect(getStudy().group).toEqual({ name: "Brygada", link: "" });
    expect(saveGroup("Brygada", "chat.whatsapp.com/AbCdEf1234567890xyZ")).toBe(true);
    expect(getStudy().group?.link).toMatch(/^https:\/\/chat\.whatsapp\.com\/AbCdEf1234567890xyZ$/);
    expect(saveGroup("", "")).toBe(true);
    expect(getStudy().group).toBeNull();
  });
});

describe("listy i pola karty budowy", () => {
  it("dokumenty, plan na dziś i serwis zapisują się w karcie; nieznana budowa — nic", () => {
    const id = lipowa();
    setSiteDocs(id, [{ id: HASH, name: "rzut.jpg", size: 1000, type: "image/jpeg", at: 2000 }]);
    setSitePlan(id, [{ id: "p1", text: "Podejścia w łazience", at: 2000 }]);
    setSiteService(id, [{ id: "s1", text: "Cieknie syfon", at: 2000, due: "2026-10-20" }]);
    expect(site(id).docs).toEqual([{ id: HASH, name: "rzut.jpg", size: 1000, type: "image/jpeg", at: 2000 }]);
    expect(site(id).plan?.map((p) => p.text)).toEqual(["Podejścia w łazience"]);
    expect(site(id).service).toEqual([{ id: "s1", text: "Cieknie syfon", at: 2000, due: "2026-10-20" }]);
    setSiteDocs("nie-ma", []);
    expect(siteDirectoryOf(getStudy()).some((s) => s.id === "nie-ma")).toBe(false);
  });

  it("gwarancja i stawka: ustawienie i zdjęcie; stawka 0 usuwa", () => {
    const id = lipowa();
    setSiteWarranty(id, "2028-10-16");
    setSiteRate(id, 55);
    expect(site(id)).toMatchObject({ warranty: "2028-10-16", rate: 55 });
    setSiteWarranty(id, null);
    setSiteRate(id, 0);
    expect(site(id).warranty).toBeUndefined();
    expect(site(id).rate).toBeUndefined();
  });
});

describe("nauka", () => {
  it("recordExam: id z urządzenia i chwili, wynik w stanie", () => {
    const exam = recordExam({ at: 5000, correct: 15, total: 20, seconds: 600, byTopic: {} });
    expect(exam.id).toMatch(/-5000$/);
    expect(getStudy().exams?.some((e) => e.id === exam.id)).toBe(true);
  });

  it("updateCustomQuestion: nieznane id albo temat → null; zmiana zachowuje id", () => {
    const topic = TOPICS[0].id;
    const input = { topic, question: "Ile bar?", correct: "6", wrong: ["1", "2", "3"] as [string, string, string], explanation: "" };
    const q = addCustomQuestion(input)!;
    expect(updateCustomQuestion("c-nie-ma", input)).toBeNull();
    expect(updateCustomQuestion(q.id, { ...input, topic: "nie-ma" })).toBeNull();
    const updated = updateCustomQuestion(q.id, { ...input, question: "Ile bar przy próbie?" })!;
    expect(updated.id).toBe(q.id);
    expect(getStudy().custom.find((e) => e.id === q.id)).toMatchObject({ question: "Ile bar przy próbie?" });
  });

  it("restoreChecklist przywraca odhaczenia wyczyszczone przez resetChecklist", () => {
    toggleChecked(CHECKLIST[0].id);
    const cleared = resetChecklist();
    expect(Object.keys(getStudy().checked)).toEqual([]);
    restoreChecklist(cleared);
    expect(Object.keys(getStudy().checked)).toEqual([CHECKLIST[0].id]);
  });

  it("dueToday: bez kart nic na dziś", () => {
    expect(dueToday(getStudy())).toEqual([]);
  });
});
