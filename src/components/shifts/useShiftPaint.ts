import { useCallback } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { setDayEntry, setDayShift, shiftHours, shiftStore, type DayEntry, type ShiftHours, type ShiftType } from "@/lib/shifts";
import { parseDayKey } from "@/lib/week";
import { toastWithUndo } from "@/lib/undoToast";
import type { Brush } from "./BrushBar";

/** Krótka data dnia do komunikatów czytnika (np. „5 paź”). */
export const shortDate = (key: string) => format(parseDayKey(key), "d MMM", { locale: pl });

interface ShiftPaintDeps {
  brush: Brush;
  activeHours: ShiftHours | null;
  typesById: Map<string, ShiftType>;
  toastReplaced: (key: string, previous: DayEntry, nextId: string) => void;
  setOpenDay: (key: string | null) => void;
  setAnnounce: (text: string) => void;
}

/**
 * Stuknięcie dnia w Grafiku (G3.2): pędzel nanosi zmianę, godziny albo czyści dzień, a „inspect” otwiera dzień.
 * Wydzielone z `ShiftsView` bez zmiany zachowania.
 */
export function useShiftPaint({ brush, activeHours, typesById, toastReplaced, setOpenDay, setAnnounce }: ShiftPaintDeps) {
  return useCallback((key: string) => {
    if (brush.kind === "inspect") return setOpenDay(key);
    const entry = shiftStore.get().days[key];
    // Ta sama zmiana drugi raz = zdejmij ją — szybka poprawka bez sięgania po gumkę.
    if (brush.kind === "type" && activeHours) {
      const h = shiftHours(activeHours);
      const same = entry?.type === brush.id && entry.customHours && entry.hours
        && entry.hours.start === h.start && entry.hours.end === h.end && entry.hours.breakMin === h.breakMin;
      if (same) { setDayShift(key, null); return; }
      // Te same szczegóły dnia co przy zwykłym pędzlu (plan 1.4); godziny zastępuje wpisany przed chwilą zakres.
      setDayEntry(key, {
        type: brush.id,
        ...(entry?.note ? { note: entry.note } : {}),
        ...(entry?.extraMin ? { extraMin: entry.extraMin } : {}),
        ...(entry?.offSchedule ? { offSchedule: true as const } : {}),
        ...(entry?.inLieu ? { inLieu: true as const } : {}),
        hours: h,
        customHours: true,
      });
      setAnnounce(`${shortDate(key)}: ${typesById.get(brush.id)?.name ?? "zmiana"} ${h.start}–${h.end}`);
      // Nadpisanie istniejącego wpisu — dajemy Cofnij, bo malowanie nie ma gumki na jeden dzień.
      if (entry) toastReplaced(key, entry, brush.id);
      return;
    }
    const clear = brush.kind === "erase" || entry?.type === brush.id;
    setDayShift(key, clear ? null : brush.id);
    setAnnounce(clear ? `${shortDate(key)}: wyczyszczono` : `${shortDate(key)}: ${typesById.get(brush.id)?.name ?? "zmiana"}`);
    if (!clear && entry && entry.type !== brush.id) toastReplaced(key, entry, brush.id);
    // Notatki i odchylenia nie da się odtworzyć jednym stuknięciem — stąd „Cofnij”.
    if (clear && entry && (entry.note || entry.extraMin)) {
      const [y, m, d] = key.split("-").map(Number);
      toastWithUndo(`Wyczyszczono ${format(new Date(y, m - 1, d), "d MMMM", { locale: pl })}`, () => setDayEntry(key, entry), {
        description: entry.note ? `Razem z notatką „${entry.note}”` : "Razem z odchyleniem od planu",
      });
    }
  }, [brush, activeHours, typesById, toastReplaced, setOpenDay, setAnnounce]);
}
