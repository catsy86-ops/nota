import { Plus, Ruler, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoteImage } from "@/components/NoteImage";
import { metersPerPixel } from "@/lib/plans/geometry";
import { removePlan, restorePlan } from "@/lib/plans/plansStore";
import type { PlanData } from "@/lib/plans/yPlans";
import { pluralPl } from "@/lib/plural";
import { toastWithUndo } from "@/lib/undoToast";

const dateLabel = (at: number) => new Date(at).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });

/** Lista analiz: miniatura, nazwa, liczba tras, stan skali. Stuknięcie otwiera edytor. */
export function PlansList({ plans, onOpen, onNew }: { plans: PlanData[]; onOpen: (pid: string) => void; onNew: () => void }) {
  function remove(d: PlanData) {
    const entries = removePlan(d.project.id);
    if (entries) toastWithUndo(`Usunięto analizę „${d.project.name}”`, () => restorePlan(entries));
  }

  return (
    <section aria-label="Analizy planów" className="space-y-3" data-testid="plans-list">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {plans.length === 0 ? "Wyznaczaj trasy rur na zrzutach planów i licz ich długość." : `${plans.length} ${pluralPl(plans.length, ["analiza", "analizy", "analiz"])}`}
        </p>
        <Button onClick={onNew} className="pressable shrink-0 coarse:h-11"><Plus className="mr-1.5 h-4 w-4" aria-hidden />Nowa analiza</Button>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-card border border-dashed border-border p-6 text-center">
          <Ruler className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="mt-2 font-display text-lg">Brak analiz</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Zrób zrzut ekranu planu w DWG FastView i dodaj go tutaj. Potem ustaw skalę z jednego znanego wymiaru i poprowadź trasy rur.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((d) => {
            const scaled = metersPerPixel(d.calibration) !== null;
            return (
              <li key={d.project.id} className="relative overflow-hidden rounded-card border border-border/60 bg-card">
                <button type="button" onClick={() => onOpen(d.project.id)} className="block w-full text-left outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  <NoteImage imageRef={d.project.work?.ref ?? d.project.image.ref} alt="" className="aspect-[16/9] w-full bg-white object-contain" placeholderClassName="aspect-[16/9]" />
                  <span className="block space-y-0.5 border-t border-border/60 px-3 py-2 pr-14">
                    <span className="block truncate font-medium">{d.project.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {d.routes.length} {pluralPl(d.routes.length, ["trasa", "trasy", "tras"])} · {scaled ? "skala ustawiona" : "bez skali"} · {dateLabel(d.lastEdit)}
                    </span>
                  </span>
                </button>
                <button type="button" onClick={() => remove(d)} aria-label={`Usuń analizę ${d.project.name}`}
                  className="absolute bottom-1.5 right-1.5 inline-flex h-10 w-10 items-center justify-center rounded-control text-muted-foreground hover:bg-muted hover:text-destructive-ink outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 coarse:w-11">
                  <Trash className="h-4 w-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
