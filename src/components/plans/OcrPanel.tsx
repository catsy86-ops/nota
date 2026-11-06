import { Check, LoaderCircle, ScanText, Trash, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { interpretOcrText, meaningLabel, OCR_SURE } from "@/lib/plans/diameters";
import type { DetectedText } from "@/lib/plans/model";
import { cn } from "@/lib/utils";

/** Propozycja z OCR — żyje tylko w edytorze; do analizy trafia po „Zatwierdź”. */
export interface OcrProposal {
  id: string;
  raw: string;
  text: string;
  box: [number, number, number, number];
  confidence: number;
}

export type OcrRun =
  | { state: "idle" }
  | { state: "running"; label: string; value: number }
  | { state: "error"; message: string };

const sectionCls = "space-y-2 border-b border-border/60 px-3 py-3 last:border-b-0";
const h3 = "text-xs font-semibold text-muted-foreground";
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function OcrSection({ run, engineCached, proposals, texts, focusId, onFocus, onRun, onCancel, onEdit, onAccept, onReject, onAcceptSure, onRemoveText }: {
  run: OcrRun;
  engineCached: boolean | null;
  proposals: readonly OcrProposal[];
  texts: readonly DetectedText[];
  focusId: string | null;
  onFocus: (id: string | null) => void;
  onRun: () => void;
  onCancel: () => void;
  onEdit: (id: string, text: string) => void;
  onAccept: (p: OcrProposal) => void;
  onReject: (id: string) => void;
  onAcceptSure: () => void;
  onRemoveText: (id: string) => void;
}) {
  const sure = proposals.filter((p) => p.confidence >= OCR_SURE && interpretOcrText(p.text)).length;
  return (
    <section className={sectionCls} aria-label="Opisy z planu" data-testid="plan-ocr">
      <h3 className={h3}>Opisy z planu (OCR)</h3>
      {run.state === "running" ? (
        <div className="space-y-2" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-sm"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />{run.label}</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={run.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(run.value * 100)}>
            <div className="h-full bg-primary transition-[width]" style={{ width: pct(run.value) }} />
          </div>
          <Button type="button" variant="outline" onClick={onCancel} className="pressable w-full coarse:h-11">Anuluj</Button>
        </div>
      ) : (
        <>
          <p className="ui-hint">
            Średnice i oznaczenia (ZW, CWU, CO) odczytane na tym urządzeniu, bez wysyłania obrazu — do sprawdzenia.
            {engineCached === false && " Pierwszy raz pobierze silnik (ok. 9 MB)."}
          </p>
          {run.state === "error" && <p role="alert" className="text-sm text-destructive-ink">{run.message}</p>}
          <Button type="button" variant={proposals.length || texts.length ? "outline" : "default"} onClick={onRun} className="pressable w-full coarse:h-11">
            <ScanText className="mr-1.5 h-4 w-4" aria-hidden />{run.state === "error" ? "Spróbuj ponownie" : proposals.length || texts.length ? "Rozpoznaj ponownie" : "Rozpoznaj opisy"}
          </Button>
        </>
      )}

      {proposals.length > 0 && (
        <div className="space-y-1.5" data-testid="plan-ocr-proposals">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Do sprawdzenia ({proposals.length})</p>
            {sure > 0 && <Button type="button" variant="ghost" onClick={onAcceptSure} className="pressable h-9 px-2 text-xs coarse:h-11">Zatwierdź pewne ({sure})</Button>}
          </div>
          <ul className="space-y-1.5">
            {proposals.map((p) => {
              const meaning = interpretOcrText(p.text);
              return (
                <li key={p.id} className={cn("rounded-control border border-dashed border-primary/60 p-1.5", focusId === p.id && "bg-primary/10")}
                  onMouseEnter={() => onFocus(p.id)} onMouseLeave={() => onFocus(null)} onFocusCapture={() => onFocus(p.id)}>
                  <div className="flex items-center gap-1">
                    <input value={p.text} onChange={(e) => onEdit(p.id, e.target.value)} aria-label={`Odczytany tekst: ${p.raw}`}
                      className="h-9 min-w-0 flex-1 rounded-field border border-border bg-background px-2 font-mono text-sm outline-hidden focus:ring-2 focus:ring-ring coarse:h-11" />
                    <button type="button" onClick={() => onAccept(p)} disabled={!p.text.trim()} aria-label={`Zatwierdź „${p.text}”`}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-primary-ink hover:bg-primary/10 disabled:opacity-40 outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 coarse:w-11">
                      <Check className="h-4 w-4" aria-hidden />
                    </button>
                    <button type="button" onClick={() => onReject(p.id)} aria-label={`Odrzuć „${p.text}”`}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-muted-foreground hover:bg-muted outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 coarse:w-11">
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <p className="ui-hint mt-0.5 px-0.5">{meaningLabel(meaning)} · pewność {pct(p.confidence)}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {texts.length > 0 && (
        <div className="space-y-1" data-testid="plan-ocr-texts">
          <p className="text-sm font-medium">Na planie ({texts.length})</p>
          <ul className="space-y-0.5">
            {texts.map((t) => (
              <li key={t.id} className={cn("flex items-center gap-2 rounded-control px-1.5", focusId === t.id && "bg-primary/10")}
                onMouseEnter={() => onFocus(t.id)} onMouseLeave={() => onFocus(null)}>
                <span className="min-w-0 flex-1 truncate py-1.5 text-sm"><span className="font-mono">{t.text}</span> <span className="text-xs text-muted-foreground">· {meaningLabel(interpretOcrText(t.text))}</span></span>
                <button type="button" onClick={() => onRemoveText(t.id)} aria-label={`Usuń opis „${t.text}”`}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-muted-foreground hover:bg-muted hover:text-destructive-ink outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 coarse:w-11">
                  <Trash className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
