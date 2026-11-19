import { Camera, ListChecks, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import type { JournalKind } from "@/lib/study/store";
import { siteStages, type SiteStage } from "@/lib/study/stages";
import { hasCheckLine, stageTemplate, toggleCheckLine } from "@/lib/study/stageTemplates";
import { cardVariant } from "@/components/ui/card";

/**
 * Etap budowy we wpisie (R2.1): przypięty etap z listą kontrolną (P2.9), pigułki następnych etapów przy nowym wpisie
 * „Zrobione” i wybór etapu przy edycji. Odhaczenie etapu w karcie robi `onMarkStage` w arkuszu.
 */
export function EntryStageSection(p: {
  entryStage: SiteStage | null;
  text: string;
  onText: (update: (prev: string) => string) => void;
  isEdit: boolean;
  kind: JournalKind;
  nextStages: readonly SiteStage[];
  onMarkStage: (id: string) => void;
  /** Etapy karty budowy do wyboru przy edycji (`null` = wpis bez karty). */
  siteCard: { stages?: readonly SiteStage[] } | null;
  onStage: (id: string | null) => void;
}) {
  const { entryStage } = p;
  const tpl = entryStage ? stageTemplate(entryStage) : null;
  return (
    <>
      {entryStage && (
        <div className={cn(cardVariant("status", "success"), "flex items-center gap-2 bg-success/10 px-3 py-1.5 text-sm")} data-testid="journal-entry-stage">
          <ListChecks className="size-4 shrink-0 text-success-ink" aria-hidden />
          <span className="min-w-0 flex-1 truncate">Etap: <span className="font-medium">{entryStage.name}</span></span>
          <button
            type="button"
            onClick={() => { haptic("tap"); p.onStage(null); }}
            aria-label={`Odepnij wpis od etapu: ${entryStage.name}`}
            title="Odepnij od etapu (etap zostaje odhaczony w karcie)"
            className="pressable grid size-7 shrink-0 place-items-center rounded-field text-muted-foreground hover:bg-muted hover:text-foreground coarse:size-11"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      )}

      {/* P2.9: lista kontrolna i podpowiedzi zdjęć dla etapu; punkt dopisuje „✓ …” do opisu (drugie stuknięcie usuwa). */}
      {entryStage && tpl && (
        <div className={cn(cardVariant(), "space-y-1.5 px-3 py-2")} data-testid="journal-stage-template">
          <p className="ui-hint">Na tym etapie potwierdź w opisie:</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Lista kontrolna: ${entryStage.name}`}>
            {tpl.checklist.map((item) => {
              const on = hasCheckLine(p.text, item);
              return (
                <button key={item} type="button" aria-pressed={on}
                  onClick={() => { haptic("selection"); p.onText((prev) => toggleCheckLine(prev, item)); }}
                  className={cn("pressable inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs coarse:min-h-11 coarse:px-3",
                    on ? "border-success-ink/50 bg-success/10 text-success-ink" : "border-border text-foreground hover:bg-muted")}>
                  {on ? "✓ " : ""}{item}
                </button>
              );
            })}
          </div>
          <p className="ui-hint flex items-start gap-1.5">
            <Camera className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>Zdjęcia: {tpl.photos.join(" · ")}</span>
          </p>
        </div>
      )}

      {!p.isEdit && !entryStage && p.kind === "ok" && p.nextStages.length > 0 && (
        <div className="space-y-1" data-testid="journal-stage-chips">
          <p className="ui-hint">Skończony etap? Odhacz go — zdjęcia z wpisu trafią do protokołu przy nim:</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Następne etapy budowy">
            {p.nextStages.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => p.onMarkStage(s.id)}
                aria-label={`Odhacz etap: ${s.name}`}
                className="pressable inline-flex max-w-full items-center gap-1 rounded-full border border-success-ink/40 px-2.5 py-1 text-xs text-success-ink hover:bg-success/10 coarse:min-h-11 coarse:px-3 coarse:text-sm"
              >
                <ListChecks className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {p.isEdit && !entryStage && p.siteCard && (
        // Zapisany wpis (np. zdjęcia „przed zakryciem” sprzed odhaczenia) — przypięcie bez ruszania stanu etapu w karcie.
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <ListChecks className="size-4 shrink-0" aria-hidden />
          <span className="shrink-0">Zdjęcia do protokołu przy etapie:</span>
          <select
            value=""
            onChange={(e) => { if (e.target.value) { haptic("selection"); p.onStage(e.target.value); } }}
            aria-label="Przypnij wpis do etapu"
            className="h-9 min-w-0 flex-1 rounded-field border border-input bg-background px-2 text-sm text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11"
          >
            <option value="">— bez etapu —</option>
            {siteStages(p.siteCard).map((s) => <option key={s.id} value={s.id}>{s.done !== undefined ? `✓ ${s.name}` : s.name}</option>)}
          </select>
        </label>
      )}
    </>
  );
}
