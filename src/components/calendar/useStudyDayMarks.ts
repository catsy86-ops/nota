import { useEffect, useMemo } from "react";
import { studyReady, useStudyReady } from "@/lib/study/data";
import { studyDayMarks, type StudyDayMarks } from "@/lib/study/calendarMarks";
import { useStudy } from "@/lib/study/store";

/**
 * Znaczniki Pracy dla kalendarza (K2). Dokument Pracy dociąga się leniwie, więc do gotowości
 * mapa jest pusta, a po wczytaniu przelicza się sama. Tylko odczyt.
 */
export function useStudyDayMarks(): Map<string, StudyDayMarks> {
  const ready = useStudyReady();
  const sites = useStudy().sites;
  useEffect(() => { void studyReady(); }, []);
  return useMemo(() => (ready ? studyDayMarks(sites) : new Map<string, StudyDayMarks>()), [ready, sites]);
}
