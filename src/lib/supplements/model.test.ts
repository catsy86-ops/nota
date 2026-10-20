import { describe, it, expect } from "vitest";
import { bySupplementOrder, cleanSupplement, logKey, nextReminderAt, parseLogKey, takenCount, type Supplement } from "./model";

const sup = (id: string, when: Supplement["when"], created = 0): Supplement => ({ id, name: id, dose: "", when, created });

describe("cleanSupplement", () => {
  it("przycina nazwę i dawkę, zachowuje poprawną porę", () => {
    const out = cleanSupplement({ id: "s1", name: "  Kreatyna  ", dose: " 1 łyżka ", when: "rano", created: 5 });
    expect(out).toEqual({ id: "s1", name: "Kreatyna", dose: "1 łyżka", when: "rano", created: 5 });
  });

  it("odrzuca brak nazwy, brak id i obcą porę", () => {
    expect(cleanSupplement({ id: "s1", name: "   ", when: "rano" })).toBeNull();
    expect(cleanSupplement({ name: "x", when: "rano" })).toBeNull();
    expect(cleanSupplement({ id: "s1", name: "x", when: "o północy" })).toBeNull();
    expect(cleanSupplement(null)).toBeNull();
  });

  it("obcina zbyt długą nazwę i dawkę zamiast odrzucać wpis", () => {
    const out = cleanSupplement({ id: "s1", name: "a".repeat(200), dose: "b".repeat(200), when: "wieczorem" });
    expect(out?.name.length).toBe(60);
    expect(out?.dose.length).toBe(40);
  });

  it("brakująca dawka to pusty tekst, nie błąd", () => {
    expect(cleanSupplement({ id: "s1", name: "Omega", when: "rano" })?.dose).toBe("");
  });
});

describe("logKey / parseLogKey", () => {
  it("klucz wraca do dnia i id", () => {
    expect(parseLogKey(logKey("2026-10-20", "s-abc"))).toEqual({ day: "2026-10-20", supplementId: "s-abc" });
  });

  it("zły dzień albo brak separatora daje null", () => {
    expect(parseLogKey("20.10.2026|s1")).toBeNull();
    expect(parseLogKey("2026-10-20")).toBeNull();
    expect(parseLogKey("2026-10-20|")).toBeNull();
  });
});

describe("bySupplementOrder", () => {
  it("rano przed ciągiem dnia i wieczorem, w grupie wg czasu dodania", () => {
    const list = [sup("wiecz", "wieczorem", 1), sup("rano2", "rano", 9), sup("rano1", "rano", 2), sup("dzien", "w_ciagu_dnia", 3)];
    expect(list.sort(bySupplementOrder).map((s) => s.id)).toEqual(["rano1", "rano2", "dzien", "wiecz"]);
  });
});

describe("takenCount", () => {
  it("liczy tylko odżywki z listy odhaczone w tym dniu", () => {
    const list = [sup("a", "rano"), sup("b", "rano")];
    const taken = new Set([logKey("2026-10-20", "a"), logKey("2026-10-19", "b"), logKey("2026-10-20", "usunięta")]);
    expect(takenCount(list, taken, "2026-10-20")).toBe(1);
  });
});

describe("przypomnienie odżywki", () => {
  it("zachowuje poprawną godzinę i id przypomnienia; zła godzina przepada", () => {
    const ok = cleanSupplement({ id: "s1", name: "K", when: "rano", remindAt: "07:30", reminderNoteId: "n1" });
    expect(ok).toMatchObject({ remindAt: "07:30", reminderNoteId: "n1" });
    const bad = cleanSupplement({ id: "s1", name: "K", when: "rano", remindAt: "25:99" });
    expect(bad?.remindAt).toBeUndefined();
    expect(bad).not.toHaveProperty("remindAt");
  });

  it("nextReminderAt: dziś, gdy godzina jeszcze przed nami; jutro, gdy minęła", () => {
    const now = new Date(2026, 9, 20, 9, 0).getTime();
    expect(nextReminderAt("12:00", now)).toBe(new Date(2026, 9, 20, 12, 0).getTime());
    expect(nextReminderAt("07:30", now)).toBe(new Date(2026, 9, 21, 7, 30).getTime());
  });
});
