import { describe, it, expect } from "vitest";
import { composeReminderTimestamp, isPastReminder, toTimeInputValue, DEFAULT_REMINDER_TIME, formatReminderShort, defaultReminderTimeFor } from "./reminderTime";

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

describe("formatReminderShort", () => {
  const now = new Date(2026, 8, 28, 12, 0);
  it("dziś / jutro / wczoraj z godziną, dalej data", () => {
    expect(formatReminderShort(new Date(2026, 8, 28, 19, 10).getTime(), now)).toBe("dziś, 19:10");
    expect(formatReminderShort(new Date(2026, 8, 29, 8, 0).getTime(), now)).toBe("jutro, 08:00");
    expect(formatReminderShort(new Date(2026, 8, 27, 8, 0).getTime(), now)).toBe("wczoraj, 08:00");
    expect(formatReminderShort(new Date(2026, 9, 3, 19, 10).getTime(), now)).toBe("3 paź, 19:10");
  });
});

describe("defaultReminderTimeFor", () => {
  const now = new Date(2026, 9, 11, 14, 20);
  it("inny dzień: 09:00", () => {
    expect(defaultReminderTimeFor(new Date(2026, 9, 12), now)).toBe("09:00");
  });
  it("dziś przed 09:00: 09:00", () => {
    expect(defaultReminderTimeFor(new Date(2026, 9, 11), new Date(2026, 9, 11, 7, 0))).toBe("09:00");
  });
  it("dziś po 09:00: najbliższa pełna godzina", () => {
    expect(defaultReminderTimeFor(new Date(2026, 9, 11), now)).toBe("15:00");
  });
  it("późnym wieczorem nie wychodzi poza 23:00", () => {
    expect(defaultReminderTimeFor(new Date(2026, 9, 11), new Date(2026, 9, 11, 23, 40))).toBe("23:00");
  });
});

describe("formatReminderShort — cały dzień", () => {
  const now = new Date(2026, 9, 19, 12, 0);
  const at = (d: number, h = 9) => new Date(2026, 9, d, h, 0).getTime();

  it("cały dzień: godzina 9:00 zawsze widoczna, także dziś, jutro i wczoraj", () => {
    expect(formatReminderShort(at(19), now)).toBe("dziś, 09:00");
    expect(formatReminderShort(at(20), now)).toBe("jutro, 09:00");
    expect(formatReminderShort(at(18), now)).toBe("wczoraj, 09:00");
    expect(formatReminderShort(at(25), now)).toBe("25 paź, 09:00");
  });

  it("bez flagi zostaje dotychczasowy format z godziną", () => {
    expect(formatReminderShort(at(20), now)).toBe("jutro, 09:00");
  });
});

describe("composeReminderTimestamp — zmiana czasu (Europe/Warsaw)", () => {
  // 29.03.2026: 02:00 → 03:00, więc 02:30 nie istnieje. 25.10.2026: 03:00 → 02:00.
  it("godzina z przeskoku wiosennego daje null, a nie cichą zmianę na 03:30", () => {
    expect(composeReminderTimestamp(new Date(2026, 2, 29), "02:30")).toBeNull();
  });

  it("godziny po przeskoku i dni bez zmiany działają jak zwykle", () => {
    const after = composeReminderTimestamp(new Date(2026, 2, 29), "03:30");
    expect(after).not.toBeNull();
    expect(new Date(after!).getHours()).toBe(3);
    expect(new Date(after!).getMinutes()).toBe(30);

    const normal = composeReminderTimestamp(new Date(2026, 2, 28), "02:30");
    expect(new Date(normal!).getHours()).toBe(2);
  });
});
