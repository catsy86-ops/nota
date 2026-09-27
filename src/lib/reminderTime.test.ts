import { describe, it, expect } from "vitest";
import { composeReminderTimestamp, isPastReminder, toTimeInputValue, DEFAULT_REMINDER_TIME } from "./reminderTime";

describe("composeReminderTimestamp", () => {
  it("skleja dzień z godziną, zerując sekundy", () => {
    const ts = composeReminderTimestamp(new Date(2026, 2, 14, 23, 59, 59, 999), "07:05");
    const d = new Date(ts as number);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 2, 14]);
    expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([7, 5, 0, 0]);
  });

  it("przyjmuje godzinę jednocyfrową", () => {
    const ts = composeReminderTimestamp(new Date(2026, 0, 1), "9:30");
    expect(new Date(ts as number).getHours()).toBe(9);
  });

  it("nie modyfikuje przekazanej daty", () => {
    const date = new Date(2026, 2, 14, 23, 0);
    const before = date.getTime();
    composeReminderTimestamp(date, "07:05");
    expect(date.getTime()).toBe(before);
  });

  it("pusta lub niepełna godzina daje null zamiast NaN", () => {
    const date = new Date(2026, 2, 14);
    for (const bad of ["", "  ", "7", "07:", ":30", "abc", "07:5"]) {
      expect(composeReminderTimestamp(date, bad)).toBeNull();
    }
  });

  it("godzina poza zakresem daje null, zamiast przewijać się na kolejny dzień", () => {
    const date = new Date(2026, 2, 14);
    expect(composeReminderTimestamp(date, "24:00")).toBeNull();
    expect(composeReminderTimestamp(date, "12:60")).toBeNull();
  });

  it("domyślna godzina jest poprawna dla tego samego parsera", () => {
    expect(composeReminderTimestamp(new Date(2026, 2, 14), DEFAULT_REMINDER_TIME)).not.toBeNull();
  });
});

describe("isPastReminder", () => {
  const now = new Date(2026, 2, 14, 12, 0).getTime();

  it("rozpoznaje przeszłość i przyszłość", () => {
    expect(isPastReminder(now - 1, now)).toBe(true);
    expect(isPastReminder(now + 1, now)).toBe(false);
  });

  it("dokładnie „teraz” nie jest przeszłością", () => {
    expect(isPastReminder(now, now)).toBe(false);
  });

  it("brak terminu nie jest przeszłością", () => {
    expect(isPastReminder(null, now)).toBe(false);
  });
});

describe("toTimeInputValue", () => {
  it("formatuje z wiodącym zerem", () => {
    expect(toTimeInputValue(new Date(2026, 2, 14, 7, 5).getTime())).toBe("07:05");
    expect(toTimeInputValue(new Date(2026, 2, 14, 23, 59).getTime())).toBe("23:59");
  });

  it("jest odwrotnością składania", () => {
    const date = new Date(2026, 2, 14);
    const ts = composeReminderTimestamp(date, "16:45") as number;
    expect(toTimeInputValue(ts)).toBe("16:45");
  });
});
