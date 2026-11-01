import { useRef } from "react";
import { ArrowLeft, Maximize, Minus, Plus } from "lucide-react";
import { useImageUrl } from "@/hooks/useImageUrl";
import type { PlanData } from "@/lib/plans/yPlans";
import { PlanCanvas, type PlanCanvasHandle } from "./PlanCanvas";

const toolBtn = "pressable inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-control px-2.5 text-sm font-medium text-foreground hover:bg-muted outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 coarse:min-w-11";

/**
 * Edytor jednej analizy: plan na całą wysokość okna, pasek u góry. Wyświetla kopię roboczą, gdy jest
 * (lżejsza), a gdy jej bajtów nie ma na urządzeniu — oryginał. Pomiary zawsze w pikselach oryginału.
 */
export function PlanEditor({ plan, onBack }: { plan: PlanData; onBack: () => void }) {
  const { project } = plan;
  const canvas = useRef<PlanCanvasHandle>(null);
  const workUrl = useImageUrl(project.work?.ref ?? "");
  // Oryginał wczytujemy tylko bez kopii roboczej albo gdy jej bajtów nie ma tu (`null`) — nie oba naraz.
  const needOriginal = !project.work || workUrl === null;
  const imageUrl = useImageUrl(needOriginal ? project.image.ref : "");
  const url = needOriginal ? imageUrl : workUrl;

  return (
    <section aria-label={`Analiza: ${project.name}`} className="flex h-[calc(100dvh-8.5rem)] min-h-[24rem] flex-col overflow-hidden rounded-card border border-border/60 bg-card sm:h-[calc(100dvh-7rem)]" data-testid="plan-editor">
      <div className="flex items-center gap-1 border-b border-border/60 px-1.5 py-1">
        <button type="button" onClick={onBack} className={toolBtn} aria-label="Wróć do listy analiz">
          <ArrowLeft className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Analizy</span>
        </button>
        <h2 className="min-w-0 flex-1 truncate px-1 font-display text-base">{project.name}</h2>
        <span className="hidden font-mono text-xs tabular-nums text-muted-foreground md:inline" title="Wymiary oryginału">
          {project.image.w}×{project.image.h} px
        </span>
        <button type="button" onClick={() => canvas.current?.zoomBy(0.8)} className={toolBtn} aria-label="Oddal"><Minus className="h-4 w-4" aria-hidden /></button>
        <button type="button" onClick={() => canvas.current?.zoomBy(1.25)} className={toolBtn} aria-label="Przybliż"><Plus className="h-4 w-4" aria-hidden /></button>
        <button type="button" onClick={() => canvas.current?.fit()} className={toolBtn} aria-label="Dopasuj do ekranu" title="Dopasuj do ekranu (0)">
          <Maximize className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <PlanCanvas
          ref={canvas}
          url={url}
          width={project.image.w}
          height={project.image.h}
          label={`Plan ${project.name}. Przesuwaj palcem albo strzałkami, przybliżaj dwoma palcami, kółkiem albo klawiszami plus i minus, zero dopasowuje do ekranu.`}
        />
      </div>
    </section>
  );
}
