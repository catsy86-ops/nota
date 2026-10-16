import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useLatestRef } from "@/hooks/useLatestRef";
import { showSystemNotification } from "@/lib/systemNotification";
import { useShifts, useShiftsReady } from "@/lib/shifts";
// Warstwa danych, nie `store.ts`: ten importuje materiał do nauki, który nie musi się ładować przy starcie.
import { useStudyReady, yStudy } from "@/lib/study/data";
import { entriesPl } from "@/lib/study/journalView";
import { dailyReportNudge, REPORT_NUDGE_KEY } from "@/lib/study/reportNudge";
import { JOURNAL_REPORT_PARAM, requestJournalReport } from "@/lib/study/reportLink";

/**
 * Po końcu dzisiejszej zmiany (Grafik) przypomina raz dziennie: „Raport dnia gotowy” — dymek
 * w aplikacji i, przy zgodzie, powiadomienie systemowe. „Otwórz raport” prowadzi do okna raportu
 * z dzisiejszymi wpisami, skąd jednym stuknięciem idzie do szefa (WhatsApp) albo do grupy.
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

    function check() {
      let last: string | null = null;
      try { last = localStorage.getItem(REPORT_NUDGE_KEY); } catch { /* bez localStorage */ }
      const nudge = dailyReportNudge(journalRef.current, shiftsRef.current, new Date(), last);
      if (!nudge) return;
      try { localStorage.setItem(REPORT_NUDGE_KEY, nudge.dayKey); } catch { /* ignore */ }

      const description = `${entriesPl(nudge.entries)} z dziś${nudge.sites > 1 ? ` na ${nudge.sites} budowach` : ""} — wyślij szefowi jednym stuknięciem.`;
      toast("📋 Raport dnia gotowy", {
        id: "daily-report-nudge",
        description,
        duration: 20000,
        action: { label: "Otwórz raport", onClick: () => { requestJournalReport(); openRef.current(); } },
      });
      showSystemNotification("Raport dnia gotowy", { body: description, tag: "daily-report-nudge", url: `/praca?${JOURNAL_REPORT_PARAM}=dzis` });
    }

    check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, [shiftsReady, studyReady, journalRef, shiftsRef, openRef]);

  return null;
}
