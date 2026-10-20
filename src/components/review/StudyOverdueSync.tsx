import { useEffect, useMemo } from "react";
import { useStudyReady } from "@/lib/study/data";
import { useStudy } from "@/lib/study/store";
import { studyReminders } from "@/lib/study/reminders";
import { studyDueRows } from "@/lib/study/dueRows";
import { setStudyOverdueCount } from "@/lib/studyOverdueCount";

/**
 * Podaje liczbę terminów Pracy do paska bocznego i tytułu karty — tę samą listę, którą
 * pokazują Terminy (`StudyDueRows`). Nic nie rysuje. Leniwy, żeby dane Pracy nie weszły do paczki startowej.
 */
export default function StudyOverdueSync() {
  const ready = useStudyReady();
  if (!ready) return null;
  return <StudyOverdueCounter />;
}

function StudyOverdueCounter() {
  const study = useStudy();
  // Godzina z renderu, jak w `StudyDueRows` — terminy zmieniają się wraz z dziennikiem.
  const count = useMemo(() => studyDueRows(studyReminders(study.journal, Date.now(), study.sites)).length, [study.journal, study.sites]);
  useEffect(() => { setStudyOverdueCount(count); }, [count]);
  useEffect(() => () => setStudyOverdueCount(0), []);
  return null;
}
