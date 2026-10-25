import { describe, expect, it } from "vitest";
import { CHECKLIST, TOPICS } from "./content";
import { topicById, topicNoteId, topicQuestionCount, topicToNote } from "./toNote";
import { closeJournalSheet, getJournalEditForm, openJournalEdit, openJournalSheet, patchJournalEditForm, journalEditImageRefs } from "./entrySheet";
import type { JournalEntry } from "./yStudy";

// Notatka tematu i arkusz edycji wpisu (Etap 5 § 5.6): czyste części, bez Yjs.
describe("toNote: notatka tematu", () => {
  const topic = TOPICS[0];

  it("tytuł, etykieta nauki i stałe id z tematu", () => {
    const n = topicToNote(topic, 1000);
    expect(n.id).toBe(topicNoteId(topic.id));
    expect(n.title).toBe(`Nauka: ${topic.title}`);
    expect(n.labels).toEqual(["nauka"]);
    expect(n.createdAt).toBe(1000);
  });

  it("lista kontrolna tematu ma tyle punktów, ile wpisów w materiale", () => {
    const n = topicToNote(topic, 1);
    expect(n.checklist?.length ?? 0).toBe(CHECKLIST.filter((c) => c.topic === topic.id).length);
    expect(n.checklist?.every((c) => c.checked === false)).toBe(true);
  });

  it("pomocnicze: liczba pytań i wyszukiwanie tematu", () => {
    expect(topicById(topic.id)?.title).toBe(topic.title);
    expect(topicById("nie-ma-takiego")).toBeUndefined();
    expect(topicQuestionCount("nie-ma-takiego")).toBe(0);
  });
});

describe("entrySheet: arkusz edycji wpisu", () => {
  const entry = {
    id: "e1", at: 1000, kind: "problem", topic: "spadki", text: "Przeciek", site: "Lipowa", checked: ["a"],
    images: ["img1"], recordings: [], resolved: null, test: null, fittings: [], stage: null, geo: null,
  } as unknown as JournalEntry;

  it("otwarcie edycji wypełnia formularz i rozwija listę, gdy są odhaczone punkty", () => {
    openJournalEdit(entry);
    const form = getJournalEditForm();
    expect(form).toMatchObject({ id: "e1", topic: "spadki", text: "Przeciek", images: ["img1"] });
    expect(journalEditImageRefs()).toEqual(["img1"]);
    closeJournalSheet();
  });

  it("zmiana formularza nie działa po zamknięciu arkusza", () => {
    openJournalEdit(entry);
    closeJournalSheet();
    patchJournalEditForm({ text: "inne" });
    expect(getJournalEditForm()).toBeNull();
  });

  it("nowy wpis nie ma formularza edycji", () => {
    openJournalSheet();
    expect(getJournalEditForm()).toBeNull();
    closeJournalSheet();
  });
});
