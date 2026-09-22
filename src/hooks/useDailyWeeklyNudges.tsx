import { useEffect } from "react";
import { toast } from "sonner";
import type { Note } from "@/hooks/useNotes";
import { getTodayRange, getWeekRange } from "@/lib/dateRanges";
import { ReminderToast } from "@/components/ReminderToast";

export interface DailyWeeklyNudgePrefs {
  todayReminderHours: number;
  todayReminderTime: string;
  weekReminderTime: string;
  weekReminderDay: number;
}

interface NudgeSchedulerOptions {
  nudgeKey: string;
  snoozeKey: string;
  getCount: () => number;
  isDue: (lastNudge: number, now: number) => boolean;
  buildTitle: (count: number) => string;
  description: string;
  onShow: () => void;
  snoozeDescription: string;
  duration: number;
}

/** Shared "check every minute, fire once, allow a 10-minute snooze" scheduler. */
function createNudgeScheduler({
  nudgeKey, snoozeKey, getCount, isDue, buildTitle, description, onShow, snoozeDescription, duration,
}: NudgeSchedulerOptions) {
  function fire() {
    const count = getCount();
    if (count === 0) return;
    try { localStorage.setItem(nudgeKey, String(Date.now())); } catch { /* ignore */ }
    toast.custom((id) => (
      <ReminderToast
        toastId={id}
        title={buildTitle(count)}
        description={description}
        onShow={onShow}
        onSnooze={() => {
          try { localStorage.setItem(snoozeKey, String(Date.now() + 10 * 60 * 1000)); } catch { /* ignore */ }
          toast("💤 Drzemka 10 min", { description: snoozeDescription });
        }}
      />
    ), { duration });
  }

  function check() {
    const snoozeUntil = Number(localStorage.getItem(snoozeKey) || 0);
    const now = Date.now();
    if (snoozeUntil && now < snoozeUntil) return;
    const lastNudge = Number(localStorage.getItem(nudgeKey) || 0);
    if (!isDue(lastNudge, now)) return;
    fire();
  }

  return check;
}

/** Nudge for "Dziś" — either at a fixed daily time ("HH:mm") or every X hours. */
export function useDailyWeeklyNudges(prefs: DailyWeeklyNudgePrefs, notes: Note[], setView: (v: "today" | "week") => void) {
  useEffect(() => {
    const intervalHours = prefs.todayReminderHours;
    const fixedTime = prefs.todayReminderTime;
    if ((!intervalHours || intervalHours <= 0) && !fixedTime) return;

    const check = createNudgeScheduler({
      nudgeKey: "kaczy.todayNudgeAt",
      snoozeKey: "kaczy.todaySnoozeUntil",
      getCount: () => {
        const { start, end } = getTodayRange();
        return notes.filter((n) => (n.createdAt >= start && n.createdAt <= end) || (n.updatedAt >= start && n.updatedAt <= end)).length;
      },
      isDue: (lastNudge, now) => {
        if (fixedTime && /^\d{1,2}:\d{2}$/.test(fixedTime)) {
          const [h, m] = fixedTime.split(":").map(Number);
          const target = new Date(); target.setHours(h, m, 0, 0);
          const targetMs = target.getTime();
          if (now < targetMs) return false;
          return lastNudge < targetMs;
        }
        if (intervalHours > 0) {
          const dueAfterMs = intervalHours * 60 * 60 * 1000;
          return !lastNudge || now - lastNudge >= dueAfterMs;
        }
        return false;
      },
      buildTitle: (count) => `📅 Masz ${count} ${count === 1 ? "notatkę" : count < 5 ? "notatki" : "notatek"} z dzisiaj`,
      description: "Wejdź w widok „Dziś”, aby je przejrzeć.",
      onShow: () => setView("today"),
      snoozeDescription: "Przypomnę o notatkach z „Dziś” za 10 minut.",
      duration: 10000,
    });

    const initial = setTimeout(check, 5000);
    const poll = setInterval(check, 60_000);
    return () => { clearTimeout(initial); clearInterval(poll); };
  }, [notes, prefs.todayReminderHours, prefs.todayReminderTime, setView]);

  // Weekly reminder for "Ten tydzień" — fires at a fixed time on a chosen weekday.
  useEffect(() => {
    const fixedTime = prefs.weekReminderTime;
    if (!fixedTime || !/^\d{1,2}:\d{2}$/.test(fixedTime)) return;

    const check = createNudgeScheduler({
      nudgeKey: "kaczy.weekNudgeAt",
      snoozeKey: "kaczy.weekSnoozeUntil",
      getCount: () => {
        const { start, end } = getWeekRange();
        return notes.filter((n) => (n.createdAt >= start && n.createdAt <= end) || (n.updatedAt >= start && n.updatedAt <= end)).length;
      },
      isDue: (lastNudge, now) => {
        const nowDate = new Date(now);
        if (nowDate.getDay() !== prefs.weekReminderDay) return false;
        const [h, m] = fixedTime.split(":").map(Number);
        const target = new Date(); target.setHours(h, m, 0, 0);
        const targetMs = target.getTime();
        if (now < targetMs) return false;
        return lastNudge < targetMs;
      },
      buildTitle: (count) => `🗓️ ${count} ${count === 1 ? "notatka" : count < 5 ? "notatki" : "notatek"} z tego tygodnia`,
      description: "Zerknij na podsumowanie ostatnich 7 dni.",
      onShow: () => setView("week"),
      snoozeDescription: "Przypomnę o notatkach z tygodnia za 10 minut.",
      duration: 12000,
    });

    const initial = setTimeout(check, 6000);
    const poll = setInterval(check, 60_000);
    return () => { clearTimeout(initial); clearInterval(poll); };
  }, [notes, prefs.weekReminderTime, prefs.weekReminderDay, setView]);
}
