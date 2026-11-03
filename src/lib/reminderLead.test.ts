import { beforeEach, describe, expect, it } from "vitest";
import { buildIcs } from "./icsExport";
import { buildPushSchedule } from "./push/schedule";
import { isLeadMinutes, leadAt, leadKey, leadPhrase, leadShort, loadFiredLeads, planLeadReminders, saveFiredLeads } from "./reminderLead";
import { mergeSpec, readSpec } from "./reminderSpec";
import type { Note } from "@/hooks/useNotes";

const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m).getTime();
const HOUR = 60 * 60_000;

function note(over: Partial<Note> = {}): Note {
  return {
    id: "n1", title: "Odbiór kotłowni", content: "", color: "default", pinned: false, archived: false,
    trashed: false, trashedAt: null, labels: [], reminder: at(5, 10), reminderLead: 60,
    priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: 0, updatedAt: at(1, 8),
    ...over,
  };
}

describe("wcześniejsze przypomnienie — plan", () => {
  it("odpala między chwilą sygnału a terminem, raz na termin", () => {
    expect(planLeadReminders([note()], new Set(), at(5, 8, 59))).toEqual([]);
    expect(planLeadReminders([note()], new Set(), at(5, 9, 30)).map((n) => n.id)).toEqual(["n1"]);
    expect(planLeadReminders([note()], new Set([leadKey("n1", at(5, 10))]), at(5, 9, 30))).toEqual([]);
    // O samej porze dzwoni już termin, nie zapowiedź.
    expect(planLeadReminders([note()], new Set(), at(5, 10))).toEqual([]);
  });

  it("nie odpala, gdy notatkę zmieniono po chwili sygnału (termin ustawiony na za chwilę, odłożenie)", () => {
    expect(planLeadReminders([note({ updatedAt: at(5, 9, 40) })], new Set(), at(5, 9, 45))).toEqual([]);
  });

  it("seria codzienna z sygnałem „Dzień”: przesunięcie na jutro kilka sekund po terminie nie gasi sygnału", () => {
    // Termin 5.11 10:00 zadzwonił, seria przeszła na 6.11 10:00 o 10:00:15 — sygnał „jutro o tej porze” to 5.11 10:00.
    const advanced = note({ reminder: at(6, 10), reminderLead: 1440, reminderRepeat: "daily", updatedAt: at(5, 10) + 15_000 });
    expect(planLeadReminders([advanced], new Set(), at(5, 10, 1))).toHaveLength(1);
  });

  it("odłożone wystąpienie serii i notatka bez sygnału go nie mają", () => {
    expect(leadAt(note({ reminderBase: at(5, 9) }))).toBeNull();
    expect(leadAt(note({ reminderLead: undefined }))).toBeNull();
    expect(leadAt(note())).toBe(at(5, 9));
  });

  it("nowe wystąpienie serii to nowy klucz — dostaje własny sygnał", () => {
    const fired = new Set([leadKey("n1", at(4, 10))]);
    expect(planLeadReminders([note()], fired, at(5, 9, 30))).toHaveLength(1);
  });

  it("zapis zbioru zostawia tylko przyszłe terminy (bez listy notatek — przy starcie jest pusta)", () => {
    localStorage.clear();
    const fired = new Set([leadKey("n1", at(5, 10)), leadKey("n1", at(4, 10)), "zły-wpis"]);
    saveFiredLeads(fired, at(5, 9, 30), true);
    expect([...loadFiredLeads()]).toEqual([leadKey("n1", at(5, 10))]);
  });
});

describe("wcześniejsze przypomnienie — teksty i walidacja", () => {
  it("frazy", () => {
    expect(leadPhrase(15)).toBe("Za 15 min");
    expect(leadPhrase(60)).toBe("Za godzinę");
    expect(leadPhrase(180)).toBe("Za 3 h");
    expect(leadPhrase(1440)).toBe("Jutro o tej porze");
    expect(leadShort(1440)).toBe("dzień wcześniej");
    expect(leadShort(60)).toBe("1 h wcześniej");
  });

  it("odczyt od peera odrzuca złe wartości", () => {
    expect(isLeadMinutes(60)).toBe(true);
    expect(isLeadMinutes(0)).toBe(false);
    expect(isLeadMinutes(1.5)).toBe(false);
    expect(isLeadMinutes(99999)).toBe(false);
    expect(readSpec({ reminder: 1, reminderLead: 60 })).toEqual({ reminder: 1, reminderLead: 60 });
    expect(readSpec({ reminder: 1, reminderLead: "60" })).toEqual({ reminder: 1 });
  });
});

describe("wcześniejsze przypomnienie — reminderSpec", () => {
  it("zmiana terminu zostawia sygnał, usunięcie terminu go czyści", () => {
    expect(mergeSpec({ reminder: 1, reminderLead: 15 }, { reminder: 2 })).toEqual({ reminder: 2, reminderLead: 15 });
    expect(mergeSpec({ reminder: 1, reminderLead: 15 }, { reminder: null })).toEqual({ reminder: null });
    expect(mergeSpec({ reminder: 1, reminderLead: 15 }, { reminderLead: undefined })).toEqual({ reminder: 1 });
  });
});

describe("wcześniejsze przypomnienie — push i .ics", () => {
  beforeEach(() => localStorage.clear());

  it("push: osobny wpis przed terminem, bez „Odłóż”", () => {
    const items = buildPushSchedule({ now: at(4, 12), notes: [{ id: "n1", title: "Odbiór kotłowni", content: "", reminder: at(5, 10), reminderLead: 60 }] });
    expect(items.map((i) => i.key)).toEqual([`n:n1:${at(5, 10)}:lead`, `n:n1:${at(5, 10)}`]);
    expect(items[0]).toMatchObject({ at: at(5, 10) - HOUR, title: "Za godzinę: Odbiór kotłowni" });
    expect(items[0].snooze).toBeUndefined();
  });

  it("push: odłożone wystąpienie serii bez zapowiedzi, kolejne z nią", () => {
    const items = buildPushSchedule({ now: at(4, 12), notes: [{ id: "n1", title: "Leki", content: "", reminder: at(5, 10), reminderBase: at(5, 9), reminderRepeat: "daily", reminderLead: 15 }] });
    expect(items.some((i) => i.key === `n:n1:${at(5, 10)}:lead`)).toBe(false);
    expect(items.some((i) => i.key.endsWith(":lead"))).toBe(true);
  });

  it(".ics: drugi VALARM z TRIGGER przed terminem", () => {
    const ics = buildIcs([note()], at(1, 12));
    expect(ics).toContain("TRIGGER:PT0M\r\n");
    expect(ics).toContain("TRIGGER:-PT60M\r\n");
    expect(ics).toContain("DESCRIPTION:Za godzinę: Odbiór kotłowni\r\n");
    expect(buildIcs([note({ reminderLead: undefined })], at(1, 12))).not.toContain("-PT");
  });
});
