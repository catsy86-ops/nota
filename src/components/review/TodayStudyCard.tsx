import { useSyncExternalStore } from "react";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pluralPl } from "@/lib/plural";
import { localDayKey } from "@/lib/dayDone";
// Warstwa danych i SRS, nie `study/store.ts` — ten importuje cały materiał do nauki.
import { useStudyReady, yStudy } from "@/lib/study/data";
import { dueIds } from "@/lib/study/srs";

/** Parametr adresu: `/praca?powtorka=1` otwiera quiz od razu w trybie „Na dziś”. */
export const STUDY_DUE_PARAM = "powtorka";

/** Sam widok karty — testowany bez danych. Bez powtórek na dziś karty nie ma. */
export function TodayStudyCardView({ due, onPractice }: { due: number; onPractice: () => void }) {
  if (due <= 0) return null;
  return (
    <section aria-label="Powtórki na dziś" data-testid="today-study" className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-sm sm:text-base">
          <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            Powtórki na dziś: <span className="font-mono font-semibold tabular-nums" data-testid="today-study-count">{due}</span>{" "}
            <span className="text-muted-foreground">{pluralPl(due, ["pytanie", "pytania", "pytań"])} · kilka minut</span>
          </span>
        </p>
        <Button size="sm" onClick={onPractice} className="coarse:h-11">Powtórz</Button>
      </div>
    </section>
  );
}

/**
 * Powtórki pytań z działu Praca (SRS) na stronie „Dziś” — nauka bez wchodzenia do Pracy.
 * Ładowana leniwie z `Index.tsx`, czyta tylko stan powtórek (`yStudy` z `data.ts`).
 */
export function TodayStudyCard({ onPractice }: { onPractice: () => void }) {
  const ready = useStudyReady();
  const study = useSyncExternalStore(yStudy.subscribe, yStudy.get);
  if (!ready) return null;
  return <TodayStudyCardView due={dueIds(study.review, localDayKey()).length} onPractice={onPractice} />;
}
