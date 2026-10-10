import { describe, expect, it } from "vitest";
import { searchShiftDays } from "./searchDays";
import type { DayEntry, ShiftType } from "./model";

const t = (id: string, name: string, short: string, extra: Partial<ShiftType> = {}): ShiftType =>
  ({ id, name, short, color: "#000", start: "08:00", end: "16:00", breakMin: 0, ...extra });
const types = new Map([
  ["d", t("d", "Dniówka", "D")],
  ["n", t("n", "Noc", "N", { start: "22:00", end: "06:00" })],
  ["u", t("u", "Urlop", "U", { kind: "absence" })],
]);
const today = new Date(2026, 9, 7);
const days: Record<string, DayEntry> = {
  "2026-10-02": { type: "d" },
  "2026-10-08": { type: "n", note: "dentysta rano" },
  "2026-10-12": { type: "u" },
  "2026-11-01": { type: "d" },
};

describe("searchShiftDays", () => {
  it("szuka po nazwie zmiany, najbliższe dni pierwsze, minione na końcu", () => {
    expect(searchShiftDays("dniówka", days, types, today).map((h) => h.key)).toEqual(["2026-11-01", "2026-10-02"]);
  });

  it("toleruje brak polskich znaków i końcówki („nocka” → Noc)", () => {
    expect(searchShiftDays("dniowka", days, types, today)).toHaveLength(2);
    expect(searchShiftDays("nocka", days, types, today).map((h) => h.key)).toEqual(["2026-10-08"]);
  });

  it("szuka po dacie, notatce i święcie", () => {
    expect(searchShiftDays("12 października", days, types, today).map((h) => h.key)).toEqual(["2026-10-12"]);
    expect(searchShiftDays("dentysta", days, types, today).map((h) => h.key)).toEqual(["2026-10-08"]);
    expect(searchShiftDays("świętych", days, types, today).map((h) => h.key)).toEqual(["2026-11-01"]);
  });

  it("wszystkie słowa muszą pasować", () => {
    expect(searchShiftDays("noc dentysta", days, types, today)).toHaveLength(1);
    expect(searchShiftDays("noc urlop", days, types, today)).toHaveLength(0);
  });

  it("zbyt krótkie zapytanie i brak dni dają pustą listę", () => {
    expect(searchShiftDays("d", days, types, today)).toEqual([]);
    expect(searchShiftDays("urlop", {}, types, today)).toEqual([]);
  });

  it("zwraca etykiety do wyświetlenia", () => {
    const [hit] = searchShiftDays("noc", days, types, today);
    expect(hit.dateLabel).toBe("czwartek, 8 października");
    expect(hit.shiftLabel).toBe("Noc 22:00–06:00");
  });
});
