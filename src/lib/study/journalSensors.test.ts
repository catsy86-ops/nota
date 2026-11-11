import { beforeEach, describe, expect, it, vi } from "vitest";
import { draftHasContent, sanitizeDraft, EMPTY_DRAFT } from "./draft";
import { getJournalEditForm, openJournalEdit, closeJournalSheet } from "./entrySheet";
import { addJournalEntry, getStudy, updateJournalEntry } from "./store";
import { resetStudyForTests } from "./data";
import { yjsStore } from "@/lib/yjsStore";

// Wyniki z czujników i narzędzi (poziomnica B3.4, skaner/NFC B3.5/B3.11, streszczenie AI B3.6, wymiary B3.3)
// nie mogą ginąć po drodze: formularz → zapis → edycja → szkic. Wcześniej `entryFields` ich nie przepuszczał.

const REF = "a".repeat(64);
const dims = { [REF]: [{ from: [0.1, 0.2] as [number, number], to: [0.6, 0.2] as [number, number], text: "35 cm od narożnika" }] };

beforeEach(async () => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 14, 12));
  await yjsStore.resetForTests();
  resetStudyForTests();
});

describe("pola czujników we wpisie", () => {
  it("addJournalEntry zapisuje poziomnicę, kod, streszczenie i wymiary", () => {
    const e = addJournalEntry({ kind: "ok", topic: null, text: "Pion w łazience", images: [REF], level: 1.234, barcode: "5901234123457", summary: "Pion sprawdzony, spadek 1,2°.", dimensions: dims });
    expect(e).not.toBeNull();
    const saved = getStudy().journal.find((x) => x.id === e!.id)!;
    expect(saved.level).toBe(1.23);
    expect(saved.barcode).toBe("5901234123457");
    expect(saved.summary).toBe("Pion sprawdzony, spadek 1,2°.");
    expect(saved.dimensions?.[REF]?.[0].text).toBe("35 cm od narożnika");
  });

  it("wymiary tylko dla zdjęć, które są we wpisie; śmieci i nadmiar odpadają", () => {
    const other = "b".repeat(64);
    const many = Array.from({ length: 30 }, (_, i) => ({ from: [0, 0] as [number, number], to: [1, 1] as [number, number], text: `w${i}` }));
    const e = addJournalEntry({ kind: "ok", topic: null, text: "x", images: [REF], dimensions: { ...dims, [other]: dims[REF], [REF]: many, bad: [{ from: [NaN, 0], to: [1, 1], text: "x" }] as never } })!;
    const saved = getStudy().journal.find((x) => x.id === e.id)!;
    expect(Object.keys(saved.dimensions ?? {})).toEqual([REF]);
    expect(saved.dimensions![REF]).toHaveLength(20);
  });

  it("updateJournalEntry zmienia i kasuje te pola, a openJournalEdit ładuje je do formularza", () => {
    const e = addJournalEntry({ kind: "ok", topic: null, text: "Pion", level: 2, barcode: "ABC", summary: "S" })!;
    openJournalEdit(getStudy().journal.find((x) => x.id === e.id)!);
    expect(getJournalEditForm()).toMatchObject({ level: 2, barcode: "ABC", summary: "S" });
    closeJournalSheet();

    updateJournalEntry(e.id, { kind: "ok", topic: null, text: "Pion", site: e.site, resolved: null, level: 3.5 });
    const after = getStudy().journal.find((x) => x.id === e.id)!;
    expect(after.level).toBe(3.5);
    expect(after.barcode).toBeUndefined(); // usunięte w formularzu = usunięte we wpisie
    expect(after.summary).toBeUndefined();
  });

  it("szkic wpisu zachowuje te pola po odświeżeniu (sanitizeDraft)", () => {
    const d = sanitizeDraft(EMPTY_DRAFT, { ...EMPTY_DRAFT, text: "x", images: [REF], level: 1.5, barcode: "XYZ", summary: "S", dimensions: dims });
    expect(d).toMatchObject({ level: 1.5, barcode: "XYZ", summary: "S" });
    expect(d.dimensions?.[REF]).toHaveLength(1);
  });

  it("wpis z samym pomiarem spadku albo kodem jest pełnoprawny; samo streszczenie nie (audyt UI #6)", () => {
    expect(addJournalEntry({ kind: "ok", topic: null, text: "", level: 1.2 })).not.toBeNull();
    expect(addJournalEntry({ kind: "ok", topic: null, text: "", barcode: "5901234567890" })).not.toBeNull();
    expect(addJournalEntry({ kind: "ok", topic: null, text: "", summary: "tylko streszczenie" })).toBeNull();
    expect(draftHasContent({ ...EMPTY_DRAFT, level: 0.4 })).toBe(true);
    expect(draftHasContent({ ...EMPTY_DRAFT, barcode: "X" })).toBe(true);
    expect(draftHasContent(EMPTY_DRAFT)).toBe(false);
  });
});
