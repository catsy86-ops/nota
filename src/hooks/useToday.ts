import { useEffect, useState } from "react";
import { isSameDay } from "date-fns";

/** Odświeża „dziś” po północy — PWA bywa otwarta całą noc. */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = new Date();
      setToday((t) => (isSameDay(t, now) ? t : now));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return today;
}
