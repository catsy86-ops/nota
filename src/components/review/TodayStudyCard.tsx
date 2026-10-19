import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pluralPl } from "@/lib/plural";
import { useStudy, dueToday } from "@/lib/study/store";
import { useStudyReady } from "@/lib/study/data";

/** Parametr adresu: `/praca?powtorka=1` otwiera quiz od razu w trybie „Na dziś”. */
export const STUDY_DUE_PARAM = "powtorka";

/** Sam widok karty — testowany bez danych. Bez powtórek na dziś karty nie ma. */
export function TodayStudyCardView({ due, onPractice }: { due: number; onPractice: () => void }) {
  if (due <= 0) return null;
  return (
    <section aria-label="Powtórki na dziś" data-testid="today-study" className="rounded-card border border-border bg-card p-4 sm:p-5">
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
 * Ładowana leniwie z `Index.tsx`. Liczy przez tę samą projekcję i `dueToday` co Praca
 * („Na dziś: N”), więc licznik nie zawyża kart pytań, których już nie ma w materiale.
 */
export function TodayStudyCard({ onPractice }: { onPractice: () => void }) {
  const ready = useStudyReady();
  const study = useStudy();
  if (!ready) return null;
  return <TodayStudyCardView due={dueToday(study).length} onPractice={onPractice} />;
}
