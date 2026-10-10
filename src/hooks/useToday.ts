import { useEffect, useState } from "react";
import { isSameDay } from "date-fns";
import { subscribeDayClock } from "@/lib/dayClock";

/**
 * Odświeża „dziś” po północy i po powrocie do karty — PWA bywa otwarta całą
 * noc, a telefon uśpiony (timery stoją). Sygnał daje `lib/dayClock.ts`.
 */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => {
      const now = new Date();
      setToday((t) => (isSameDay(t, now) ? t : now));
    };
    refresh();
    return subscribeDayClock(refresh);
  }, []);
  return today;
}
