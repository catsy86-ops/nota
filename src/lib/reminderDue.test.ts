import { describe, expect, it } from "vitest";
import { planDueReminders } from "./reminderDue";
import type { Note } from "@/hooks/useNotes";

const DAY = 24 * 60 * 60 * 1000;
const at = (y: number, m: number, d: number, h = 9) => new Date(y, m, d, h, 0, 0, 0).getTime();

const note = (over: Partial<Note>): Note => ({ id: "n1", title: "T", content: "", reminder: null, ...over } as Note);

describe("planDueReminders", () => {
  it("jednorazowe przypomnienie w terminie odpala się raz", () => {
    const now = at(2026, 9, 19, 10);
    const steps = planDueReminders([note({ reminder: at(2026, 9, 19, 9) })], new Set(), now);
    expect(steps).toHaveLength(1);
    expect(steps[0].kind).toBe("once");
    expect(steps[0].missed).toBe(0);
  });

  it("przypomnienie w przyszłości nie odpala się", () => {
    const steps = planDueReminders([note({ reminder: at(2026, 9, 20, 9) })], new Set(), at(2026, 9, 19, 10));
    expect(steps).toEqual([]);
  });

  it("zaległa seria dzienna (od 14. do 19. dnia) daje JEDEN krok, pomija 5 cykli i przesuwa na przyszłość", () => {
    const now = at(2026, 9, 19, 10);
    const steps = planDueReminders([note({ reminder: at(2026, 9, 14, 9), reminderRepeat: "daily" })], new Set(), now);
    expect(steps).toHaveLength(1);
    expect(steps[0].kind).toBe("series");
    // Odpalany jest termin z 14., pominięte są 15, 16, 17, 18 i 19 (dziś o 9:00 już minęło).
    expect(steps[0].missed).toBe(5);
    expect(steps[0].next).toBe(at(2026, 9, 20, 9));
  });

  it("seria na czas: jeden krok, bez pominiętych, następny wystąpienie to kolejny dzień", () => {
    const now = at(2026, 9, 19, 10);
    const [step] = planDueReminders([note({ reminder: at(2026, 9, 19, 9), reminderRepeat: "daily" })], new Set(), now);
    expect(step.missed).toBe(0);
    expect(step.next).toBe(at(2026, 9, 20, 9));
  });

  it("seria, której koniec minął, dostaje next = null (seria się kończy)", () => {
    const now = at(2026, 9, 19, 10);
    const [step] = planDueReminders(
      [note({ reminder: at(2026, 9, 10, 9), reminderRepeat: "daily", reminderRepeatUntil: at(2026, 9, 12, 23) })],
      new Set(),
      now,
    );
    // Pominięte: 11. i 12.; po 12. kolejny termin (13.) wypada po końcu serii.
    expect(step.next).toBeNull();
    expect(step.missed).toBe(2);
  });

  it("seria miesięczna pilnuje dnia kotwiczącego (31 → ostatni dzień krótszych miesięcy)", () => {
    const now = at(2026, 5, 15, 10);
    const [step] = planDueReminders(
      [note({ reminder: at(2026, 0, 31, 9), reminderRepeat: "monthly", reminderDay: 31 })],
      new Set(),
      now,
    );
    // Czerwiec nie ma 31. dnia: pierwszy przyszły termin to 30 czerwca.
    expect(step.next).toBe(at(2026, 5, 30, 9));
  });

  it("rejestr „już odpalone” blokuje jednorazowe", () => {
    const now = at(2026, 9, 19, 10);
    expect(planDueReminders([note({ reminder: at(2026, 9, 19, 9) })], new Set(["n1"]), now)).toEqual([]);
  });

  it("terminy już obsłużone (handled) nie odpalają się drugi raz, aż zapis przesunięcia dotrze", () => {
    const now = at(2026, 9, 19, 10);
    const n = note({ reminder: at(2026, 9, 19, 9), reminderRepeat: "daily" });
    expect(planDueReminders([n], new Set(), now, new Map([["n1", n.reminder!]]))).toEqual([]);
    // Po przesunięciu termin jest inny — notatka znów podlega sprawdzeniu.
    const moved = { ...n, reminder: at(2026, 9, 19, 9) + DAY };
    expect(planDueReminders([moved], new Set(), now, new Map([["n1", n.reminder!]]))).toEqual([]);
  });

  it("dwa sprawdzenia z rzędu z tą samą notatką dają krok tylko za pierwszym razem", () => {
    const now = at(2026, 9, 19, 10);
    const n = note({ reminder: at(2026, 9, 14, 9), reminderRepeat: "daily" });
    const handled = new Map<string, number>();
    const first = planDueReminders([n], new Set(), now, handled);
    expect(first).toHaveLength(1);
    handled.set("n1", n.reminder!);
    expect(planDueReminders([n], new Set(), now, handled)).toEqual([]);
  });

  it("notatki bez terminu są pomijane", () => {
    expect(planDueReminders([note({ reminder: null })], new Set(), Date.now())).toEqual([]);
  });
});
