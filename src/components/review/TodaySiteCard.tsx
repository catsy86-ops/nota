import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useStudyReady } from "@/lib/study/data";
import { JOURNAL_ENTRY_PARAM } from "@/lib/study/entrySheet";
import { setSite } from "@/lib/study/store";

// Karta „przed wejściem” na Dziś (2.4 planu Praca 2026-10-24): budowa z dzisiejszym wpisem albo bieżąca,
// z Nawiguj, Zadzwoń i „+ Wpis”. Ładowana leniwie — ciężka lista kontroli jest w osobnym kawałku.
const EntryCheckCard = lazy(() => import("@/components/study/EntryCheck").then((m) => ({ default: m.EntryCheckCard })));

export function TodaySiteCard() {
  const ready = useStudyReady();
  const navigate = useNavigate();
  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <EntryCheckCard
        onNewEntry={(siteName) => {
          // „+ Wpis” z Dziś: budowa zostaje wybrana, a Praca otwiera arkusz wpisu (`?wpis=1`).
          setSite(siteName);
          navigate(`/praca?${JOURNAL_ENTRY_PARAM}=1`);
        }}
      />
    </Suspense>
  );
}
