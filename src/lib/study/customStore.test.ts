import { describe, it, expect, beforeEach, vi } from "vitest";
import { CHECKLIST, QUESTIONS } from "./content";
import { CALC_QUESTIONS } from "./calcQuestions";
import { studyLists, getStudy, toggleChecked, recordRound, addCustomItem, addCustomQuestion, removeCustomEntry, restoreCustomEntry, sanitizeStudy } from "./store";
import { resetStudyForTests, yStudy } from "./data";
import { yjsStore } from "@/lib/yjsStore";

async function freshStudy() {
  localStorage.clear();
  // Zegar zamrożony: `recordRound` i `addJournalEntry` biorą dzień i chwilę z "teraz" (T6).
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 14, 12));
  await yjsStore.resetForTests();
  resetStudyForTests();
}

const question = {
  topic: "system",
  question: "Własne pytanie?",
  correct: "Tak",
  wrong: ["Nie", "Może", "Nie wiem"] as [string, string, string],
  explanation: "Bo tak.",
};

describe("własne pytania i punkty listy (N5)", () => {
  beforeEach(freshStudy);

  it("punkt własny dochodzi do listy materiału i do odhaczeń", () => {
    const item = addCustomItem("laczenie", "Sprawdź uszczelkę");
    expect(item?.id.startsWith("c-")).toBe(true);
    const lists = studyLists(getStudy().custom);
    expect(lists.checklist.map((c) => c.id)).toContain(item!.id);
    expect(lists.checklist.length).toBe(CHECKLIST.length + 1);
    toggleChecked(item!.id);
    expect(getStudy().checked[item!.id]).toBe(true);
  });

  it("pytanie własne dochodzi do puli quizu z poprawną odpowiedzią na pierwszym miejscu", () => {
    const saved = addCustomQuestion(question);
    expect(saved).not.toBeNull();
    const pool = studyLists(getStudy().custom).questions;
    expect(pool.length).toBe(QUESTIONS.length + CALC_QUESTIONS.length + 1);
    const mine = pool.find((x) => x.id === saved!.id);
    expect(mine?.options).toEqual(["Tak", "Nie", "Może", "Nie wiem"]);
    expect(mine?.explanation).toBe("Bo tak.");
  });

  it("odrzuca nieznany temat i pytanie z dwiema takimi samymi odpowiedziami", () => {
    expect(addCustomItem("obcy", "tekst")).toBeNull();
    expect(addCustomQuestion({ ...question, topic: "obcy" })).toBeNull();
    expect(addCustomQuestion({ ...question, wrong: ["Tak", "Nie", "Może"] })).toBeNull();
    expect(getStudy().custom).toHaveLength(0);
  });

  it("usunięcie pytania zabiera jego powtórki i błędy; cofnięcie przywraca wpis", () => {
    const saved = addCustomQuestion(question)!;
    recordRound(0, 1, ["system"], [{ id: saved.id, ok: false }]);
    expect(getStudy().review[saved.id]).toBeDefined();
    expect(getStudy().missed[saved.id]).toBe(true);

    const removed = removeCustomEntry(saved.id);
    expect(removed?.id).toBe(saved.id);
    expect(getStudy().custom).toHaveLength(0);
    expect(getStudy().review[saved.id]).toBeUndefined();
    expect(getStudy().missed[saved.id]).toBeUndefined();

    restoreCustomEntry(removed!);
    expect(getStudy().custom.map((e) => e.id)).toEqual([saved.id]);
  });

  it("usunięcie punktu zdejmuje jego odhaczenie", () => {
    const item = addCustomItem("system", "Coś")!;
    toggleChecked(item.id);
    removeCustomEntry(item.id);
    expect(getStudy().checked[item.id]).toBeUndefined();
  });

  it("wpis z obcym tematem, który przyszedł od peera, nie wraca do widoku", () => {
    yStudy.addCustom({ kind: "item", id: "c-obcy", topic: "nieznany", text: "x" });
    expect(getStudy().custom).toHaveLength(0);
    expect(sanitizeStudy({ ...getStudy(), custom: [{ kind: "item", id: "c-ok", topic: "system", text: "y" }] }, {}).custom).toEqual([]);
  });
});
