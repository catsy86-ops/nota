import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Note } from "@/hooks/useNotes";
import type { Occurrence } from "@/lib/reminderOccurrences";

// Strefa z przeskokiem 29.03.2026 02:00 → 03:00 (jak w `reminderRepeat.dst.test.ts`).
process.env.TZ = "Europe/Warsaw";

vi.mock("@/lib/undoToast", () => ({ toastWithUndo: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

const local = (d: number, h: number, min = 0) => new Date(2026, 2, d, h, min).getTime();

describe("useCalendarMoves przez zmianę czasu (Z-8.2)", () => {
  it("przeniesienie odłożonego wystąpienia liczy następny termin serii od jej godziny 2:30, nie od 3:30 z dnia przeskoku", async () => {
    const { useCalendarMoves } = await import("./useCalendarMoves");
    // Seria dzienna o 2:30; 29.03 tej godziny nie ma, więc termin serii wypadł na 3:30, a wystąpienie odłożono na 4:45.
    const note = {
      id: "n1", reminder: local(29, 4, 45), reminderBase: local(29, 3, 30), reminderTime: 150, reminderRepeat: "daily",
    } as unknown as Note;
    const onSetReminder = vi.fn();
    const { result } = renderHook(() => useCalendarMoves({
      notesById: new Map([[note.id, note]]), onSetReminder,
      month: new Date(2026, 2, 1), setMonth: vi.fn(), selectedDay: new Date(2026, 2, 29), setSelectedDay: vi.fn(),
    }));
    const occ = { noteId: "n1", at: note.reminder, isSeries: true, index: 0, isNext: true, repeat: { kind: "daily" }, allDay: false } as unknown as Occurrence;

    // 30.03 2:45 jest już po następnym terminie serii (30.03 2:30), więc przeniesienie przestawia całą serię.
    // Bez godziny serii następny termin wyszedłby 30.03 3:30 i zostałby stary `reminderBase`.
    result.current.moveToHour(occ, new Date(2026, 2, 30), 2);
    expect(onSetReminder).toHaveBeenCalledTimes(1);
    const [, reminder, , , base] = onSetReminder.mock.calls[0];
    expect(reminder).toBe(local(30, 2, 45));
    expect(base).toBeUndefined();
  });
});
