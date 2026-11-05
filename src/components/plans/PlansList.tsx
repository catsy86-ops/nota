import { ImagePlus, Plus, Ruler, Spline, Trash } from "lucide-react";
import { EmptyIllustration } from "@/components/EmptyIllustration";
import { StatusPanel } from "@/components/StatusPanel";
import { PageActions } from "@/components/PageActions";
import { Button } from "@/components/ui/button";
import type { PlanImage } from "@/lib/plans/model";
import { usePlanImageUrl } from "./usePlanImageUrl";
import { metersPerPixel } from "@/lib/plans/geometry";
import { removePlan, restorePlan } from "@/lib/plans/plansStore";
import type { PlanData } from "@/lib/plans/yPlans";
import { pluralPl } from "@/lib/plural";
import { toastWithUndo } from "@/lib/undoToast";

const dateLabel = (at: number) => new Date(at).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });

/** Lista analiz: miniatura, nazwa, liczba tras, stan skali. Stuknięcie otwiera edytor. */
const EMPTY_STEPS = [
  { Icon: ImagePlus, title: "Zrzut planu", text: "Zrób zrzut ekranu w DWG FastView i dodaj go przez „Nowa analiza”." },
  { Icon: Ruler, title: "Skala", text: "Zaznacz jeden znany wymiar, np. ścianę 4,25 m." },
  { Icon: Spline, title: "Trasy", text: "Poprowadź rury albo wskaż ich kolor — długości policzą się w metrach." },
] as const;

export function PlansList({ plans, onOpen, onNew }: { plans: PlanData[]; onOpen: (pid: string) => void; onNew: () => void }) {
  function remove(d: PlanData) {
    const entries = removePlan(d.project.id);
    if (entries) toastWithUndo(`Usunięto analizę „${d.project.name}”`, () => restorePlan(entries));
  }

  return (
    <section aria-label="Analizy planów" className="space-y-3" data-testid="plans-list">
      {/* Opis działu jest w główce (`ViewTitle`), „Nowa analiza” w jej akcjach (nowy plan 1.1). */}
      <PageActions>
        <Button size="sm" onClick={onNew} className="pressable shrink-0 coarse:h-11"><Plus className="mr-1.5 h-4 w-4" aria-hidden />Nowa analiza</Button>
      </PageActions>
      {plans.length > 0 && (
        <p className="text-sm text-muted-foreground">{plans.length} {pluralPl(plans.length, ["analiza", "analizy", "analiz"])}</p>
      )}

      {plans.length === 0 ? (
        // Pusty stan jako trzy kroki (plan wyglądu, Faza 7): to prawdziwa kolejność pracy, więc numeracja coś mówi.
        // Ramka, szkic i tytuł ze `StatusPanel` jak w innych działach (nowy plan 2.5).
        <StatusPanel size="inline" className="p-5 sm:p-6" art={<EmptyIllustration view="plans" />} title="Brak analiz">
          <ol className="mt-4 grid gap-3 text-left sm:grid-cols-3 sm:gap-4">
            {EMPTY_STEPS.map(({ Icon, title, text }, i) => (
              <li key={title} className="flex gap-3 sm:flex-col sm:gap-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground" aria-hidden>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium"><span className="font-mono text-muted-foreground">{i + 1}.</span> {title}</p>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </StatusPanel>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((d) => {
            const scaled = metersPerPixel(d.calibration) !== null;
            return (
              <li key={d.project.id} className="relative overflow-hidden rounded-card border border-border/60 bg-card">
                <button type="button" onClick={() => onOpen(d.project.id)} className="block w-full text-left outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  <PlanThumb image={d.project.work ?? d.project.image} />
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

/** Miniatura analizy — obraz dopiero po sprawdzeniu bajtów (`usePlanImageUrl`). */
function PlanThumb({ image }: { image: PlanImage }) {
  const url = usePlanImageUrl(image);
  if (url && url !== "bad") return <img src={url} alt="" className="aspect-[16/9] w-full bg-white object-contain" loading="lazy" />;
  return <span aria-hidden className="block aspect-[16/9] w-full bg-muted/60" />;
}
