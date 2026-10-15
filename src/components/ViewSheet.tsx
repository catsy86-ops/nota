import { Check, Columns2, Kanban, LayoutGrid, List, Table2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { setViewPref, useViewPrefs, type Density, type Layout } from "@/lib/viewPrefs";
import { changeView } from "@/lib/viewChange";
import type { GroupBy } from "@/lib/groupNotes";

/** Układy z jednym zdaniem: na telefonie nazwa „Mozaika” czy „Tablica” niewiele mówi bez opisu. */
const LAYOUTS: { v: Layout; label: string; hint: string; icon: typeof LayoutGrid }[] = [
  { v: "masonry", label: "Mozaika", hint: "Kafle w kolumnach, wysokie jak treść", icon: LayoutGrid },
  { v: "grid", label: "Siatka", hint: "Równe rzędy kafli", icon: Columns2 },
  { v: "list", label: "Lista", hint: "Kafle jeden pod drugim, na całą szerokość", icon: List },
  { v: "board", label: "Tablica", hint: "Kolumny wg etykiet — przesuwasz w bok", icon: Kanban },
  { v: "table", label: "Tabela", hint: "Same tytuły i daty, najwięcej na ekranie", icon: Table2 },
];

const DENSITIES: { v: Density; label: string }[] = [
  { v: "compact", label: "Kompakt" },
  { v: "cozy", label: "Komfort" },
  { v: "comfy", label: "Luźno" },
];

const GROUPS: { v: GroupBy; label: string }[] = [
  { v: "none", label: "Brak" },
  { v: "date", label: "Data" },
  { v: "label", label: "Etykieta" },
  { v: "folder", label: "Folder" },
];

type ColumnsChoice = "auto" | 1 | 2;
const COLUMNS: { v: ColumnsChoice; label: string; aria: string }[] = [
  { v: "auto", label: "Auto", aria: "Automatycznie" },
  { v: 1, label: "1", aria: "1 kolumna" },
  { v: 2, label: "2", aria: "2 kolumny" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pt-5">
      <h3 className="px-1 pb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

/** Przełącznik segmentowy: jedna z kilku opcji, cele 44 px. */
function Segmented<T extends string | number>({ label, options, value, onChange }: {
  label: string;
  options: { v: T; label: string; aria?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl bg-muted/50 p-1">
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button
            key={String(o.v)}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.aria}
            onClick={() => onChange(o.v)}
            className={cn(
              "pressable h-11 flex-1 rounded-lg text-sm transition-colors duration-fast tabular-nums",
              on ? "bg-card font-semibold text-primary-ink shadow-elevation-1" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * „Widok i kolumny” na telefonie: arkusz od dołu zamiast małego menu — układ z opisem,
 * kolumny tylko tam, gdzie mają sens (mozaika, siatka; na telefonie najwyżej 2), gęstość i grupowanie.
 */
export function ViewSheet({ open, onOpenChange, groupable = true }: { open: boolean; onOpenChange: (open: boolean) => void; groupable?: boolean }) {
  const prefs = useViewPrefs();
  const columns: ColumnsChoice = prefs.autoColumns ? "auto" : prefs.columns <= 1 ? 1 : 2;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-border/60 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <SheetHeader className="text-left pr-10">
          <SheetTitle className="font-display">Widok</SheetTitle>
          <SheetDescription className="sr-only">Układ notatek, liczba kolumn, gęstość i grupowanie</SheetDescription>
        </SheetHeader>

        <Section title="Układ">
          <div role="radiogroup" aria-label="Układ" className="flex flex-col gap-1">
            {LAYOUTS.map((l) => {
              const on = prefs.layout === l.v;
              return (
                <button
                  key={l.v}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => changeView(() => setViewPref("layout", l.v))}
                  className={cn(
                    "pressable flex min-h-13 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-fast",
                    on ? "bg-primary/10" : "hover:bg-muted/60",
                  )}
                >
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", on ? "bg-primary/15 text-primary-ink" : "bg-muted text-muted-foreground")}>
                    <l.icon className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", on ? "font-semibold text-foreground" : "font-medium")}>{l.label}</span>
                    <span className="block text-xs text-muted-foreground">{l.hint}</span>
                  </span>
                  {on && <Check className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden />}
                </button>
              );
            })}
          </div>
        </Section>

        {(prefs.layout === "masonry" || prefs.layout === "grid") && (
          <Section title="Kolumny">
            <Segmented
              label="Kolumny"
              options={COLUMNS}
              value={columns}
              onChange={(v) => changeView(() => {
                if (v === "auto") { setViewPref("autoColumns", true); return; }
                setViewPref("autoColumns", false);
                setViewPref("columns", v);
              })}
            />
          </Section>
        )}

        <Section title="Gęstość">
          <Segmented label="Gęstość" options={DENSITIES} value={prefs.density} onChange={(v) => changeView(() => setViewPref("density", v))} />
        </Section>

        {groupable && prefs.layout !== "board" && prefs.layout !== "table" && (
          <Section title="Grupuj">
            <Segmented label="Grupuj" options={GROUPS} value={prefs.groupBy} onChange={(v) => changeView(() => setViewPref("groupBy", v))} />
          </Section>
        )}
      </SheetContent>
    </Sheet>
  );
}
