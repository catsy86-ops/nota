import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useLatestRef } from "@/hooks/useLatestRef";
import { showSystemNotification } from "@/lib/systemNotification";
import { useShifts, useShiftsReady } from "@/lib/shifts";
// Warstwa danych, nie `store.ts`: ten importuje materiał do nauki, który nie musi się ładować przy starcie.
import { useStudyReady, yStudy } from "@/lib/study/data";
import { entriesPl } from "@/lib/study/journalView";
import { dailyReportNudge, REPORT_NUDGE_KEY, WEEK_REPORT_NUDGE_KEY, weeklyReportNudge } from "@/lib/study/reportNudge";
import { JOURNAL_REPORT_PARAM, reportParam, requestJournalReport, type JournalReportRequest } from "@/lib/study/reportLink";

/**
 * Po końcu dzisiejszej zmiany (Grafik) przypomina raz dziennie: „Raport dnia gotowy” — dymek
 * w aplikacji i, przy zgodzie, powiadomienie systemowe. W piątek (albo w weekend) raz na tydzień
 * zamiast tego „Raport tygodnia gotowy” (7 dni). „Otwórz raport” prowadzi do okna raportu z tym
 * zakresem — przy kilku budowach od razu wszystkie — skąd jednym stuknięciem idzie do szefa.
 * Jak reszta przypomnień działa przy otwartej aplikacji (bez serwera push).
 *
 * Ładowany leniwie z `Index.tsx`, żeby dane działu Praca nie wchodziły do głównej paczki.
 */
export default function DailyReportNudge({ onOpenWork }: { onOpenWork: () => void }) {
  const shiftsReady = useShiftsReady();
  const studyReady = useStudyReady();
  const shifts = useShifts();
  const study = useSyncExternalStore(yStudy.subscribe, yStudy.get);
  // Dane z refów: nowy wpis czy edycja Grafiku nie restartują timera.
  const journalRef = useLatestRef(study.journal);
  const shiftsRef = useLatestRef(shifts);
  const openRef = useLatestRef(onOpenWork);

  useEffect(() => {
    if (!shiftsReady || !studyReady) return;

    const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
    const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* bez localStorage */ } };

    function remind(title: string, description: string, req: JournalReportRequest, tag: string) {
      toast(`📋 ${title}`, {
        id: tag,
        description,
        duration: 20000,
        action: { label: "Otwórz raport", onClick: () => { requestJournalReport(req); openRef.current(); } },
      });
      showSystemNotification(title, { body: description, tag, url: `/praca?${JOURNAL_REPORT_PARAM}=${reportParam(req)}` });
    }

    function check() {
      const now = new Date();
      // Piątek po pracy (albo weekend): raport tygodnia zamiast dnia — obejmuje też dzisiejsze wpisy.
      const week = weeklyReportNudge(journalRef.current, shiftsRef.current, now, read(WEEK_REPORT_NUDGE_KEY));
      if (week) {
        write(WEEK_REPORT_NUDGE_KEY, week.weekKey);
        write(REPORT_NUDGE_KEY, week.dayKey);
        const where = week.sites > 1 ? ` na ${week.sites} budowach` : "";
        remind("Raport tygodnia gotowy", `${entriesPl(week.entries)} z 7 dni${where} — wyślij szefowi jednym stuknięciem.`, { range: "week", allSites: week.sites > 1 }, "week-report-nudge");
        return;
      }
      const nudge = dailyReportNudge(journalRef.current, shiftsRef.current, now, read(REPORT_NUDGE_KEY));
      if (!nudge) return;
      write(REPORT_NUDGE_KEY, nudge.dayKey);
      // Kilka budów dziś — raport wszystkich, żeby żadna nie wypadła.
      const where = nudge.sites > 1 ? ` na ${nudge.sites} budowach` : "";
      remind("Raport dnia gotowy", `${entriesPl(nudge.entries)} z dziś${where} — wyślij szefowi jednym stuknięciem.`, { range: "day", allSites: nudge.sites > 1 }, "daily-report-nudge");
    }

    check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, [shiftsReady, studyReady, journalRef, shiftsRef, openRef]);

  return null;
}
