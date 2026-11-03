import { useShiftEveningNudge } from "@/hooks/useShiftEveningNudge";

/** Wieczorne przypomnienie o jutrzejszej zmianie jako leniwy komponent bez UI — Grafik nie jedzie w paczce startowej (Plan-nowy 1.5). */
export default function ShiftEveningNudge({ onOpenShifts }: { onOpenShifts: () => void }) {
  useShiftEveningNudge(onOpenShifts);
  return null;
}
