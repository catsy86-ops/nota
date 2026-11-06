import { useShiftEveningNudge } from "@/hooks/useShiftEveningNudge";
import { useShiftEndAction } from "@/hooks/useShiftEndAction";

/** Wieczorne przypomnienie o jutrzejszej zmianie jako leniwy komponent bez UI — Grafik nie jedzie w paczce startowej (Plan-nowy 1.5). Tu też akcja „Skończyłem” z powiadomienia o końcu zmiany (G4.1). */
export default function ShiftEveningNudge({ onOpenShifts }: { onOpenShifts: () => void }) {
  useShiftEveningNudge(onOpenShifts);
  useShiftEndAction();
  return null;
}
