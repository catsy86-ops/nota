import { HardHat, ChevronRight } from "lucide-react";
import { m as motion, useReducedMotion } from "framer-motion";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import { useStudyReady } from "@/lib/study/data";
import { useDayClock } from "@/lib/dayClock";
import { useStudy } from "@/lib/study/store";
import { studyReminders } from "@/lib/study/reminders";
import { studyDueRows } from "@/lib/study/dueRows";

/**
 * Terminy z działu Praca (serwis, zamówienia bez dostawy, otwarte problemy) — tylko do odczytu.
 * Ładowany leniwie z Dziś i z Terminów, żeby dane Pracy nie weszły do paczki startowej.
 * Bez wierszy nic nie pokazuje.
 */
export function StudyDueRows({ onOpenStudy }: { onOpenStudy: (siteId?: string) => void }) {
  const ready = useStudyReady();
  if (!ready) return null;
  return <StudyDueRowsList onOpenStudy={onOpenStudy} />;
}

function StudyDueRowsList({ onOpenStudy }: { onOpenStudy: (siteId?: string) => void }) {
  const reduce = useReducedMotion();
  const study = useStudy();
  // Subskrypcja zmiany doby: po północy serwis i zamówienia z terminem „na dziś” mają przejść do listy,
  // a `Date.now()` poniżej jest wtedy świeże.
  useDayClock();
  const rows = studyDueRows(studyReminders(study.journal, Date.now(), study.sites));
  if (rows.length === 0) return null;
  return (
    <section aria-label="Terminy z Praca" data-testid="study-due" className="rounded-card border border-border bg-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-label gap-2">
          <HardHat className="h-3.5 w-3.5" aria-hidden />
          Praca
          <AnimatedNumber value={rows.length} className="stamp-tag normal-case text-primary-ink" data-testid="study-due-count" />
        </h2>
        <Button variant="ghost" size="sm" onClick={() => onOpenStudy()} className="coarse:h-11">
          Otwórz Pracę<ChevronRight className="ml-0.5 h-4 w-4" aria-hidden />
        </Button>
      </div>
      <ul className="divide-y divide-border/50">
        {rows.map((row, i) => (
          <motion.li
            key={row.key}
            data-study-due={row.kind}
            className="py-2"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.25, ease: "easeOut" }}
          >
            {/* Wiersz z budową otwiera jej kartę (`/praca?budowa=`), pozostałe wiersze są tylko informacją. */}
            {row.siteId ? (
              <button type="button" onClick={() => onOpenStudy(row.siteId ?? undefined)} aria-label={`${row.title}: karta budowy`} className="pressable block w-full rounded-md text-left coarse:min-h-11">
                <p className="text-sm">{row.title}</p>
                {row.detail && <p className="mt-0.5 text-xs text-muted-foreground">{row.detail}</p>}
              </button>
            ) : (
              <>
                <p className="text-sm">{row.title}</p>
                {row.detail && <p className="mt-0.5 text-xs text-muted-foreground">{row.detail}</p>}
              </>
            )}
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

export default StudyDueRows;
