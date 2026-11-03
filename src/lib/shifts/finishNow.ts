import { toast } from "sonner";
import { formatDuration, setDayEntry, type ShiftOccurrence } from "@/lib/shifts";
import { toastWithUndo } from "@/lib/undoToast";
import { haptic } from "@/lib/haptics";

/**
 * „Skończyłem teraz”: odchylenie od planu = różnica między teraz a planowanym końcem. Wspólne dla karty
 * „Teraz” w Grafiku i karty zmiany w Dziś (Dziś 2.1), żeby obie zapisywały koniec tak samo.
 */
export function finishShiftNow(occ: ShiftOccurrence): void {
  const plannedEnd = occ.end.getTime() - (occ.entry.extraMin ?? 0) * 60_000;
  const extra = Math.round((Date.now() - plannedEnd) / 60_000);
  if (extra === (occ.entry.extraMin ?? 0)) { toast("Zmiana już ma taki koniec"); return; }
  const before = occ.entry;
  const { extraMin: _drop, ...rest } = before;
  setDayEntry(occ.dayKey, extra === 0 ? rest : { ...rest, extraMin: extra });
  const label = extra === 0 ? "zgodnie z planem" : `${extra > 0 ? "+" : "−"}${formatDuration(Math.abs(extra))} względem planu`;
  toastWithUndo(`Zakończono zmianę: ${label}`, () => setDayEntry(occ.dayKey, before));
  haptic("success");
}
