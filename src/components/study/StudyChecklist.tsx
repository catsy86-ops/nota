import { useState } from "react";
import { RotateCcw, Search, TriangleAlert } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pluralPl } from "@/lib/plural";
import { MODULES, TOPICS } from "@/lib/study/content";
import { resetChecklist, restoreChecklist, toggleChecked, useStudy, useStudyLists } from "@/lib/study/store";
import { CustomChecklistSection } from "./CustomChecklistForm";
import { isCustomId } from "@/lib/study/custom";
import { fold } from "@/lib/study/siteKey";
import { toastWithUndo } from "@/lib/undoToast";

/** Lista do nauki: punkty z materiałów pogrupowane w moduły i tematy. */
export function StudyChecklist() {
  const study = useStudy();
  const lists = useStudyLists();
  const [onlyCritical, setOnlyCritical] = useState(false);
  // Szukanie bez polskich znaków (4.5): „szczelnosc” znajduje „szczelność”. Szuka w punkcie, ryzyku i temacie.
  const [query, setQuery] = useState("");
  const needle = fold(query.trim()).replace(/\s+/g, " ");
  const matches = (c: (typeof lists.checklist)[number]) => {
    if (!needle) return true;
    const topic = TOPICS.find((t) => t.id === c.topic)?.title ?? "";
    return fold(`${c.text} ${c.risk ?? ""} ${topic}`).includes(needle);
  };
  const visible = lists.checklist.filter((c) => (!onlyCritical || c.critical) && matches(c));
  const done = lists.checklist.filter((c) => study.checked[c.id]).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-mono text-sm tabular-nums" data-testid="checklist-progress">
          {done}<span className="text-muted-foreground">/{lists.checklist.length}</span>
        </p>
        <button
          type="button"
          aria-pressed={onlyCritical}
          onClick={() => setOnlyCritical((v) => !v)}
          className={cn(
            "pressable rounded-full border px-3 py-1 text-xs transition-colors coarse:min-h-11 coarse:px-4 coarse:text-sm",
            onlyCritical ? "border-primary bg-primary/10 text-primary-ink" : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          <TriangleAlert className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-warning-ink" aria-hidden />Tylko punkty krytyczne
        </button>
        {done > 0 && (
          <Button
            variant="ghost"
            size="sm"
            // Bez okna potwierdzenia — „Cofnij” w dymku przywraca wszystkie odhaczenia.
            onClick={() => {
              const ids = resetChecklist();
              toastWithUndo(`Wyczyszczono ${ids.length} ${pluralPl(ids.length, ["odhaczenie", "odhaczenia", "odhaczeń"])}`, () => restoreChecklist(ids));
            }}
            className="ml-auto coarse:h-11"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />Wyczyść odhaczenia
          </Button>
        )}
      </div>

      <label className="relative block max-w-md">
        <span className="sr-only">Szukaj na liście kontrolnej</span>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(ev) => setQuery(ev.target.value)}
          placeholder="Szukaj: rura, szczelność, pompa…"
          enterKeyHint="search"
          className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-base focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 md:text-sm"
        />
      </label>
      {needle && visible.length === 0 && (
        <p className="text-sm text-muted-foreground" role="status">Nic nie pasuje do „{query.trim()}”.</p>
      )}

      {MODULES.map((mod) => {
        const topics = TOPICS.filter((t) => t.module === mod.id)
          .map((t) => ({ topic: t, items: visible.filter((c) => c.topic === t.id) }))
          .filter((g) => g.items.length > 0);
        if (topics.length === 0) return null;
        return (
          <section key={mod.id} aria-label={mod.label} className="space-y-3">
            <header>
              <h3 className="font-display text-lg">{mod.label}</h3>
              <p className="text-xs text-muted-foreground">{mod.source}</p>
            </header>
            {topics.map(({ topic, items }) => (
              <div key={topic.id} className="rounded-xl border border-border bg-card p-3.5">
                <h4 className="text-sm font-medium">{topic.title}</h4>
                <ul className="mt-2 space-y-2">
                  {items.map((item) => {
                    const on = !!study.checked[item.id];
                    return (
                      <li key={item.id} className="flex items-start gap-2.5">
                        <Checkbox
                          id={`study-${item.id}`}
                          checked={on}
                          onCheckedChange={() => toggleChecked(item.id)}
                          className="mt-0.5"
                        />
                        <label htmlFor={`study-${item.id}`} className={cn("text-sm leading-snug cursor-pointer", on && "text-muted-foreground line-through decoration-muted-foreground/40")}>
                          {item.critical && <span className="mr-1 inline-flex align-[-2px]" role="img" aria-label="Punkt krytyczny"><TriangleAlert className="h-3.5 w-3.5 text-warning-ink" aria-hidden /></span>}
                          {item.text}
                          {isCustomId(item.id) && <span className="ml-1.5 align-[1px] rounded-full bg-muted px-1.5 py-px text-2xs text-muted-foreground no-underline">własny</span>}
                          {item.risk && <span className="mt-0.5 block text-xs text-muted-foreground no-underline">Ryzyko: {item.risk.replace(/^[^=]*= ?/, "")}</span>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        );
      })}

      <CustomChecklistSection />

    </div>
  );
}
