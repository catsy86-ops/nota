import { useEffect, useSyncExternalStore } from "react";
import { useLatestRef } from "@/hooks/useLatestRef";
import { activeSink } from "@/lib/reminders/sink";
import { pushPrefs } from "@/lib/push/prefs";
import { buildPushSchedulePlan, PUSH_MAX_ITEMS, type PushNote } from "@/lib/push/schedule";
import { PUSH_SUMMARY_KEY } from "@/lib/push/summary";
import { EVENING_NUDGED_KEY, readEveningNudgeTime, useShifts, useShiftsReady } from "@/lib/shifts";
import { useStudyReady, yStudy } from "@/lib/study/data";
import { getJournalDraft } from "@/lib/study/draft";
import { runEndsAt } from "@/lib/study/pressureTest";
import { REPORT_NUDGE_KEY, WEEK_REPORT_NUDGE_KEY } from "@/lib/study/reportNudge";
import { restRun } from "@/lib/training/restRun";

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const DEBOUNCE_MS = 3000;
const REFRESH_MS = 60 * 60 * 1000;

/**
 * Wysyła harmonogram przypomnień do ujścia (`lib/reminders/sink.ts`: serwer push w PWA, alarmy systemowe w APK), gdy zmienią się notatki, Grafik
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
  const off = pushPrefs.use().off;
  const ready = shiftsReady && studyReady;

  // APK: obsługa stuknięcia w alarm musi być podpięta od razu, nie dopiero przy pierwszej wysyłce.
  useEffect(() => { void activeSink().then((sink) => sink?.available()); }, []);

  useEffect(() => {
    if (!ready) return;
    const send = (keepalive = false) => {
      const test = getJournalDraft().test;
      const endsAt = test ? runEndsAt(test) : null;
      // C2.6: koniec przerwy tylko przy schowanej aplikacji — przy otwartej wibruje licznik, bez drugiego sygnału.
      const hidden = document.visibilityState === "hidden";
      const plan = buildPushSchedulePlan({
        now: Date.now(),
        pressure: test?.startedAt !== undefined && endsAt !== null ? { startedAt: test.startedAt, endsAt } : null,
        rest: hidden ? restRun.get() : null,
        notes: notesRef.current,
        journal: studyRef.current.journal,
        sites: studyRef.current.sites,
        shifts: shiftsRef.current,
        eveningTime: readEveningNudgeTime(),
        eveningNudged: read(EVENING_NUDGED_KEY),
        reportNudged: read(REPORT_NUDGE_KEY),
        weekReportNudged: read(WEEK_REPORT_NUDGE_KEY),
        off,
      });
      // Podsumowanie dla Ustawień: ile wysłano z ilu i ile odpadło przy limicie. Tylko na tym urządzeniu.
      try {
        localStorage.setItem(PUSH_SUMMARY_KEY, JSON.stringify({
          sent: plan.items.length, total: plan.total, dropped: plan.dropped, limit: PUSH_MAX_ITEMS, at: Date.now(),
          horizonEnd: plan.horizonEnd, droppedBy: plan.droppedBy,
        }));
      } catch { /* bez localStorage — bez podsumowania */ }
      void activeSink().then((sink) => sink?.replace(plan.items, keepalive, { horizonEnd: plan.horizonEnd, dropped: plan.dropped }));
    };
    const timer = window.setTimeout(send, DEBOUNCE_MS);
    const hourly = window.setInterval(send, REFRESH_MS);
    // Powrót do aplikacji z trwającą przerwą zdejmuje jej alarm (lista bez niej).
    const onHide = () => {
      if (document.visibilityState === "hidden") send(true);
      else if (restRun.get()) send();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearTimeout(timer);
      clearInterval(hourly);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [ready, notes, shifts, study, off, notesRef, shiftsRef, studyRef]);

  return null;
}
