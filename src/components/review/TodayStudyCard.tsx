import { GraduationCap } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";
import { pluralPl } from "@/lib/plural";
import { useStudy, dueToday } from "@/lib/study/store";
import { useStudyReady } from "@/lib/study/data";

/** Parametr adresu: `/praca?powtorka=1` otwiera quiz od razu w trybie „Na dziś”. */
export const STUDY_DUE_PARAM = "powtorka";

/** Sam widok karty — testowany bez danych. Bez powtórek na dziś karty nie ma. */
/** Dziś 1.5: szacunek czasu — ok. 20 s na pytanie, najmniej 1 min. */
const studyMinutes = (questions: number) => Math.max(1, Math.round((questions * 20) / 60));

export function TodayStudyCardView({ due, onPractice }: { due: number; onPractice: () => void }) {
  if (due <= 0) return null;
  return (
    // Pusta karta w jednej linijce (nowy plan 2.1): sam nagłówek z liczbą i szacunkiem czasu.
    <SectionCard aria-label="Powtórki na dziś" data-testid="today-study" icon={GraduationCap}
      title="Powtórki na dziś" meta={<span data-testid="today-study-count">{due}</span>}
      description={`${pluralPl(due, ["pytanie", "pytania", "pytań"])} · ok. ${studyMinutes(due)} min`}
      action={<Button size="sm" onClick={onPractice} className="coarse:h-11">Powtórz</Button>} />
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
