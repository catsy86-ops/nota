import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { haptic } from "@/lib/haptics";
import { activePlanItems, cleanPlanItems, PLAN_MAX, PLAN_TEXT_MAX, type PlanItem } from "@/lib/study/planItems";
import { setSitePlan } from "@/lib/study/store";
import type { SiteInfo } from "@/lib/study/sites";

/** Plan na dziś na budowie (P-5): 3–5 zadań, odhaczanie w ciągu dnia; niezrobione zostają na jutro. */
export function SitePlan({ site }: { site: SiteInfo }) {
  const [text, setText] = useState("");
  const all = site.plan ?? [];
  const items = activePlanItems(all);
  const full = all.length >= PLAN_MAX;

  // Zapis z całej listy (także pozycji z wczoraj, które znikają przy zapisie): odrzucone już zostają w historii raportu.
  function write(next: PlanItem[]) {
    setSitePlan(site.id, cleanPlanItems(next), all);
  }

  function add() {
    const clean = text.trim();
    if (!clean || full) return;
    const item: PlanItem = { id: crypto.randomUUID(), text: clean.slice(0, PLAN_TEXT_MAX), at: Date.now() };
    write([...all, item]);
    setText("");
    haptic("tap");
  }

  function toggle(id: string, done: boolean) {
    write(all.map((i) => (i.id === id ? { ...i, doneAt: done ? Date.now() : undefined } : i)));
    haptic(done ? "success" : "tap");
  }

  function remove(id: string) {
    write(all.filter((i) => i.id !== id));
    haptic("tap");
  }

  return (
    <section aria-label="Plan na dziś" className="mt-3 space-y-2 rounded-card border border-border/60 bg-muted/30 p-3" data-testid="site-plan">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan na dziś</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Wpisz 3–5 zadań na budowę. Niezrobione przejdą na jutro.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-2">
              <Checkbox checked={i.doneAt !== undefined} onCheckedChange={(v) => toggle(i.id, v === true)} aria-label={`Zrobione: ${i.text}`} className="coarse:h-6 coarse:w-6" />
              <span className={i.doneAt !== undefined ? "min-w-0 flex-1 truncate text-sm line-through text-muted-foreground" : "min-w-0 flex-1 truncate text-sm"}>{i.text}</span>
              <Button variant="ghost" size="icon" onClick={() => remove(i.id)} aria-label={`Usuń: ${i.text}`} className="coarse:h-11 coarse:w-11">
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={PLAN_TEXT_MAX} disabled={full} placeholder={full ? "Najwyżej 5 zadań" : "np. wymiana złączki w piwnicy"} aria-label="Nowe zadanie na dziś" className="coarse:h-11" />
        <Button type="submit" variant="outline" disabled={full || !text.trim()} className="coarse:h-11">Dodaj</Button>
      </form>
    </section>
  );
}
