import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { allTodayTasksDone, markDayRewarded, localDayKey, readLastRewardedDay, shouldRewardDay } from "@/lib/dayDone";
import { dayDoneReward } from "@/lib/celebrate";
import type { ChecklistItem } from "@/hooks/useNotes";

/**
 * Nagroda w widoku „Dziś”, gdy ostatnie zadanie zostaje odhaczone (przejście
 * „nie wszystko” -> „wszystko”). Raz na dzień; wejście do widoku, w którym
 * wszystko jest już zrobione, nie odpala nagrody.
 * @param notes notatki widoku „Dziś”; `null` poza tym widokiem (resetuje stan)
 */
export function useDayDoneReward(notes: { checklist?: ChecklistItem[] }[] | null) {
  const active = notes !== null;
  const done = notes ? allTodayTasksDone(notes) : false;
  const prev = useRef<boolean | null>(null);

  useEffect(() => {
    if (!active) {
      prev.current = null;
      return;
    }
    const was = prev.current;
    prev.current = done;
    if (was !== false || !done) return;
    const today = localDayKey();
    if (!shouldRewardDay(readLastRewardedDay(), today)) return;
    markDayRewarded(today);
    dayDoneReward();
    toast.success("Dzień zamknięty — wszystko na dziś zrobione", { id: "day-done", duration: 3500 });
  }, [active, done]);
}
