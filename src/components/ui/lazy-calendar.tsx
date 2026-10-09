import { lazy, Suspense } from "react";
import type { CalendarProps } from "@/components/ui/calendar";

const Calendar = lazy(() => import("@/components/ui/calendar").then((m) => ({ default: m.Calendar })));

/**
 * Kalendarz z react-day-picker dociągany dopiero przy otwarciu wyboru daty —
 * nie ma go w startowym bundlu. Zaślepka trzyma rozmiar miesiąca, żeby
 * popover nie skakał po wczytaniu.
 */
export function LazyCalendar(props: CalendarProps) {
  return (
    <Suspense fallback={<div className="w-[252px] h-[294px]" aria-busy="true" />}>
      <Calendar {...props} />
    </Suspense>
  );
}
