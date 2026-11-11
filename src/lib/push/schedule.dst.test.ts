import { describe, expect, it } from "vitest";
import { EMPTY_SHIFT_DATA, type ShiftData } from "@/lib/shifts/model";
import { buildPushSchedule } from "./schedule";

// W7: w dniu zmiany czasu alarm przed zmianą i koniec zmiany mają wypadać o godzinie zegarowej, nie przesunięte o godzinę.
describe("alarm i koniec zmiany w dniu zmiany czasu (strefa Europe/Warsaw)", () => {
  const cases = [
    { name: "wiosna (29 marca, 02:00 → 03:00)", day: "2026-03-29", from: new Date(2026, 2, 27, 12), at: (h: number) => new Date(2026, 2, 29, h).getTime() },
    { name: "jesień (25 października, 03:00 → 02:00)", day: "2026-10-25", from: new Date(2026, 9, 23, 12), at: (h: number) => new Date(2026, 9, 25, h).getTime() },
  ];
  for (const c of cases) {
    it(c.name, () => {
      const shifts: ShiftData = { ...EMPTY_SHIFT_DATA, days: { [c.day]: { type: "b" } } }; // Budowa 07:00–17:00, alarm 60 min wcześniej
      const items = buildPushSchedule({ now: c.from.getTime(), notes: [], shifts });
      const alarm = items.find((i) => i.key === `a:${c.day}`)!;
      const end = items.find((i) => i.key === `s:${c.day}`)!;
      expect(new Date(alarm.at).getHours()).toBe(6);
      expect(new Date(alarm.at).getMinutes()).toBe(0);
      expect(new Date(end.at).getHours()).toBe(17);
      expect(alarm.at).toBe(c.at(6));
      expect(end.at).toBe(c.at(17));
    });
  }
});
