import { afterEach, describe, expect, it } from "vitest";
import { clearDraft, composerReducer, draftFromFields, EMPTY_FIELDS, fieldsFromDraft, isTextEmpty, readDraft, readParked, sanitizeDraft, writeDraft, writeParked, type Draft } from "./noteDraft";
import { PARKED_MAX } from "./parkedDrafts";
import { POWLOKA } from "./storage/names";

const base: Draft = { title: "T", content: "", checklist: [], color: "default", labels: [], reminder: null, reminderRepeat: "none", priority: "none" };

afterEach(() => localStorage.clear());

describe("sanitizeDraft (A3.2)", () => {
  it("pusty szkic (bez tekstu i listy) to null, nawet z metadanymi", () => {
    expect(sanitizeDraft({ title: "  ", content: "", color: "mint", labels: ["a"] })).toBeNull();
  });

  it("odrzuca obce pola i złe wartości", () => {
    const d = sanitizeDraft({
      title: "x",
      color: "neon" as never,
      priority: "max" as never,
      labels: ["a", "", 3 as never],
      checklist: [{ id: "1", text: "a", checked: 1 as never, indent: 1 }, { id: 2 as never, text: "b", checked: false }],
      parentId: "",
    });
    expect(d).toEqual({ ...base, title: "x", labels: ["a"], checklist: [{ id: "1", text: "a", checked: true, indent: 1 }], reminderRule: undefined });
  });

  it("termin z przeszłości przepada razem z powtarzaniem", () => {
    const d = sanitizeDraft({ title: "x", reminder: Date.now() - 1000, reminderRepeat: "daily", reminderRepeatUntil: Date.now() + 1e9 });
    expect(d?.reminder).toBeNull();
    expect(d?.reminderRepeat).toBe("none");
    expect(d?.reminderRepeatUntil).toBeUndefined();
  });

  it("przyszły termin zostaje z powtarzaniem i datą końca", () => {
    const at = Date.now() + 60_000;
    const d = sanitizeDraft({ title: "x", reminder: at, reminderRepeat: "weekly", reminderRepeatUntil: at + 1e9 });
    expect(d).toMatchObject({ reminder: at, reminderRepeat: "weekly", reminderRepeatUntil: at + 1e9 });
  });

  it("najwyżej 20 etykiet", () => {
    const labels = Array.from({ length: 30 }, (_, i) => `l${i}`);
    expect(sanitizeDraft({ title: "x", labels })?.labels).toHaveLength(20);
  });
});

describe("zapis szkicu w localStorage (A3.2)", () => {
  it("writeDraft → readDraft; pusty szkic usuwa klucz", () => {
    writeDraft({ ...base, content: "treść" });
    expect(readDraft()).toMatchObject({ title: "T", content: "treść" });
    writeDraft({ ...base, title: "" });
    expect(localStorage.getItem(POWLOKA.draft)).toBeNull();
  });

  it("clearDraft usuwa szkic, uszkodzony JSON daje null", () => {
    writeDraft(base);
    clearDraft();
    expect(readDraft()).toBeNull();
    localStorage.setItem(POWLOKA.draft, "{nie json");
    expect(readDraft()).toBeNull();
  });

  it("lista robocza: uszkodzone wpisy odpadają, najwyżej PARKED_MAX", () => {
    const ok = { id: "a", at: 1, draft: base };
    localStorage.setItem(POWLOKA.drafts, JSON.stringify([ok, { id: 1, at: 1, draft: base }, { id: "b", at: 2, draft: { title: "" } }, null]));
    expect(readParked().map((e) => e.id)).toEqual(["a"]);
    writeParked(Array.from({ length: PARKED_MAX + 3 }, (_, i) => ({ id: `p${i}`, at: i, draft: base })));
    expect(readParked()).toHaveLength(PARKED_MAX);
    writeParked([]);
    expect(localStorage.getItem(POWLOKA.drafts)).toBeNull();
  });

  it("isTextEmpty patrzy tylko na tekst i listę", () => {
    expect(isTextEmpty({ title: " ", content: "\n", checklist: [] })).toBe(true);
    expect(isTextEmpty({ title: "", content: "", checklist: [{}] })).toBe(false);
  });
});

describe("composerReducer (A3.2)", () => {
  it("set przyjmuje wartość albo funkcję; ta sama wartość nie zmienia stanu", () => {
    const a = composerReducer(EMPTY_FIELDS, { type: "set", key: "title", value: "x" });
    expect(a.title).toBe("x");
    const b = composerReducer(a, { type: "set", key: "labels", value: (l) => [...l, "a"] });
    expect(b.labels).toEqual(["a"]);
    expect(composerReducer(b, { type: "set", key: "title", value: "x" })).toBe(b);
  });

  it("load ładuje szkic i czyści zdjęcia, pliki i dodatki terminu; reset daje pusty formularz", () => {
    const dirty = { ...EMPTY_FIELDS, images: ["i"], reminderAllDay: true, reminderLead: 5 };
    const d: Draft = { ...base, parentId: "p", reminder: 1, reminderRepeat: "daily", reminderRepeatUntil: 9 };
    const loaded = composerReducer(dirty, { type: "load", draft: d });
    expect(loaded).toMatchObject({ title: "T", parentId: "p", reminderUntil: 9, images: [], reminderAllDay: false, reminderLead: undefined });
    expect(composerReducer(loaded, { type: "reset" })).toBe(EMPTY_FIELDS);
  });

  it("draftFromFields ∘ fieldsFromDraft zachowuje szkic", () => {
    const d: Draft = { ...base, content: "c", parentId: "p", reminder: 1, reminderRepeat: "weekly", reminderRepeatUntil: 9 };
    expect(draftFromFields(fieldsFromDraft(d))).toEqual(d);
    expect(draftFromFields(fieldsFromDraft(base))).toEqual(base);
  });
});
