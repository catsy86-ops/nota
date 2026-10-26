import { currentAndNextShift, type ShiftData } from "@/lib/shifts";

const dayKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Terminy względem grafiku (T-2): zwykłe terminy, bez powiązania z grafikiem. Liczone w chwili otwarcia pickera;
 * późniejsza zmiana grafiku nie przesuwa zapisanego terminu. Bez danych grafiku (albo bez zmiany) nie ma pozycji.
 */
export function shiftPresets(data: ShiftData, now: Date): { label: string; at: Date }[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const out: { label: string; at: Date }[] = [];
  const today = currentAndNextShift(data, startOfToday).next;
  if (today && today.dayKey === dayKeyOf(startOfToday) && today.end.getTime() > now.getTime()) {
    out.push({ label: "Po dzisiejszej zmianie", at: today.end });
  }
  const tomorrow = currentAndNextShift(data, startOfTomorrow).next;
  if (tomorrow && tomorrow.dayKey === dayKeyOf(startOfTomorrow)) {
    out.push({ label: "30 min przed jutrzejszą zmianą", at: new Date(tomorrow.start.getTime() - 30 * 60_000) });
  }
  return out;
}
