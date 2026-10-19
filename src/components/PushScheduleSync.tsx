import { useEffect, useSyncExternalStore } from "react";
import { useLatestRef } from "@/hooks/useLatestRef";
import { uploadSchedule } from "@/lib/push/client";
import { buildPushSchedulePlan, PUSH_MAX_ITEMS, type PushNote } from "@/lib/push/schedule";
import { PUSH_SUMMARY_KEY } from "@/lib/push/summary";
import { EVENING_NUDGED_KEY, readEveningNudgeTime, useShifts, useShiftsReady } from "@/lib/shifts";
import { useStudyReady, yStudy } from "@/lib/study/data";
import { REPORT_NUDGE_KEY, WEEK_REPORT_NUDGE_KEY } from "@/lib/study/reportNudge";

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const DEBOUNCE_MS = 3000;
const REFRESH_MS = 60 * 60 * 1000;

/**
 * Wysyła harmonogram przypomnień na serwer push (`lib/push/`), gdy zmienią się notatki, Grafik
 * albo dziennik budowy — po chwili spokoju, co godzinę i od razu przy chowaniu aplikacji
 * (zwykle zaraz po dodaniu przypomnienia). Montowany leniwie z `Index.tsx`, tylko przy włączonych
 * powiadomieniach, więc dane działu Praca nie wchodzą do głównej paczki.
 */
export default function PushScheduleSync({ notes }: { notes: readonly PushNote[] }) {
  const shiftsReady = useShiftsReady();
  const studyReady = useStudyReady();
  const shifts = useShifts();
  const study = useSyncExternalStore(yStudy.subscribe, yStudy.get);
  const notesRef = useLatestRef(notes);
  const shiftsRef = useLatestRef(shifts);
  const studyRef = useLatestRef(study);
  const ready = shiftsReady && studyReady;

  useEffect(() => {
    if (!ready) return;
    const send = (keepalive = false) => {
      const plan = buildPushSchedulePlan({
        now: Date.now(),
        notes: notesRef.current,
        journal: studyRef.current.journal,
        sites: studyRef.current.sites,
        shifts: shiftsRef.current,
        eveningTime: readEveningNudgeTime(),
        eveningNudged: read(EVENING_NUDGED_KEY),
        reportNudged: read(REPORT_NUDGE_KEY),
        weekReportNudged: read(WEEK_REPORT_NUDGE_KEY),
      });
      // Podsumowanie dla Ustawień: ile wysłano z ilu i ile odpadło przy limicie. Tylko na tym urządzeniu.
      try { localStorage.setItem(PUSH_SUMMARY_KEY, JSON.stringify({ sent: plan.items.length, total: plan.total, dropped: plan.dropped, limit: PUSH_MAX_ITEMS, at: Date.now() })); } catch { /* bez localStorage — bez podsumowania */ }
      void uploadSchedule(plan.items, keepalive);
    };
    const timer = window.setTimeout(send, DEBOUNCE_MS);
    const hourly = window.setInterval(send, REFRESH_MS);
    const onHide = () => { if (document.visibilityState === "hidden") send(true); };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearTimeout(timer);
      clearInterval(hourly);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [ready, notes, shifts, study, notesRef, shiftsRef, studyRef]);

  return null;
}
