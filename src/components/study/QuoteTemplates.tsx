import { useState } from "react";
import { toast } from "sonner";
import { BookmarkPlus, FilePlus2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { pluralPl } from "@/lib/plural";
import { toastWithUndo } from "@/lib/undoToast";
import { newQuoteItemId, type Job } from "@/lib/study/jobs";
import { removeQuoteItem, saveQuoteItem, setJobMeta } from "@/lib/study/jobsStore";
import { removeTemplate, saveTemplate, useTemplates } from "@/lib/study/pricingStore";
import { planInsert, templateFromJob, TEMPLATE_NAME_MAX } from "@/lib/study/quoteTemplates";

const fieldCls = "h-9 rounded-field border border-input bg-background px-2 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm";

/**
 * Szablony wycen (plan wycen i klientów, 4.3): „Wstaw szablon” dopisuje zestaw pozycji do wyceny (z „Cofnij”), a „Zapisz jako
 * szablon” robi migawkę obecnych pozycji pod nazwą. Szablony synchronizują się z cennikami (`pricingStore.ts`).
 */
export function QuoteTemplates({ siteId, job }: { siteId: string; job: Job }) {
  const templates = useTemplates();
  const [pick, setPick] = useState("");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const chosen = templates.find((t) => t.id === pick);

  function insert() {
    if (!chosen) return;
    const plan = planInsert(chosen, job, newQuoteItemId);
    if (plan.items.length === 0) { toast.error("Wycena ma już maksymalną liczbę pozycji"); return; }
    const added: string[] = [];
    for (const item of plan.items) if (saveQuoteItem(siteId, item)) added.push(item.id);
    if (plan.margin !== undefined) setJobMeta(siteId, { margin: plan.margin });
    haptic("selection");
    if (plan.skipped > 0) toast.warning(`Wstawiono ${added.length} z ${chosen.items.length} pozycji — wycena ma limit pozycji`);
    toastWithUndo(`Wstawiono szablon „${chosen.name}”: ${added.length} ${pluralPl(added.length, ["pozycja", "pozycje", "pozycji"])}`, () => {
      for (const id of added) removeQuoteItem(siteId, id);
      if (plan.margin !== undefined) setJobMeta(siteId, { margin: undefined });
    });
    setPick("");
  }

  function save() {
    const t = templateFromJob(job, name, newQuoteItemId("qt"), Date.now());
    if (!t) { toast.error("Podaj nazwę szablonu (wycena musi mieć pozycje)"); return; }
    if (!saveTemplate(t)) { toast.error("Nie zapisano szablonu", { description: "Lista szablonów jest pełna." }); return; }
    haptic("success");
    toast.success(`Zapisano szablon „${t.name}”`);
    setName("");
    setSaving(false);
  }

  function drop() {
    if (!chosen) return;
    const removed = removeTemplate(chosen.id);
    setPick("");
    if (removed) toastWithUndo(`Usunięto szablon „${removed.name}”`, () => saveTemplate(removed));
  }

  if (templates.length === 0 && job.items.length === 0) return null;

  return (
    <div className="space-y-1.5" data-testid="quote-templates">
      {templates.length > 0 && (
        <div className="flex items-center gap-1.5">
          <label htmlFor={`quote-template-${siteId}`} className="sr-only">Szablon wyceny</label>
          <select id={`quote-template-${siteId}`} value={pick} onChange={(e) => setPick(e.target.value)} className={cn(fieldCls, "min-w-0 flex-1")}>
            <option value="">Wstaw szablon…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.items.length} poz.</option>)}
          </select>
          <Button type="button" size="sm" variant="outline" disabled={!chosen} onClick={insert} className="shrink-0 coarse:h-11" data-testid="template-insert">
            <FilePlus2 className="h-4 w-4" aria-hidden />Wstaw
          </Button>
          {chosen && (
            <button type="button" onClick={drop} aria-label={`Usuń szablon ${chosen.name}`} data-testid="template-remove"
              className="pressable grid size-8 shrink-0 place-items-center rounded-field text-muted-foreground hover:text-foreground coarse:size-11">
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      )}
      {job.items.length > 0 && (saving ? (
        <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); save(); }} aria-label="Nowy szablon wyceny">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={TEMPLATE_NAME_MAX} aria-label="Nazwa szablonu"
            placeholder="np. Łazienka — biały montaż" className={cn(fieldCls, "min-w-0 flex-1")} />
          <Button type="submit" size="sm" variant="outline" disabled={!name.trim()} className="shrink-0 coarse:h-11" data-testid="template-save">Zapisz</Button>
          <button type="button" onClick={() => { setSaving(false); setName(""); }} className="pressable shrink-0 text-xs text-muted-foreground underline underline-offset-2 coarse:min-h-11">Anuluj</button>
        </form>
      ) : (
        <button type="button" onClick={() => setSaving(true)} data-testid="template-save-open"
          className="pressable inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline coarse:min-h-11">
          <BookmarkPlus className="h-3.5 w-3.5" aria-hidden />Zapisz jako szablon
        </button>
      ))}
    </div>
  );
}
