import { Check, Columns2, Kanban, LayoutGrid, List, Table2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { setViewPref, useViewPrefs, type Density, type Layout, type SortDir, type SortKey } from "@/lib/viewPrefs";
import { useNotesContext } from "@/hooks/NotesProvider";
import { sortOptions } from "@/lib/sortOptions";
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

const DIRS: { v: SortDir; label: string }[] = [
  { v: "desc", label: "Malejąco" },
  { v: "asc", label: "Rosnąco" },
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

/** Przełącznik segmentowy: jedna z kilku opcji, cele 44 px; wartości liczbowe przez `String`. */
function Segmented<T extends string | number>({ label, options, value, onChange }: {
  label: string;
  options: { v: T; label: string; aria?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ToggleGroup
      aria-label={label}
      value={String(value)}
      onValueChange={(v) => { const o = options.find((x) => String(x.v) === v); if (o) onChange(o.v); }}
      className="flex bg-muted/50"
    >
      {options.map((o) => (
        <ToggleGroupItem key={String(o.v)} value={String(o.v)} aria-label={o.aria} className="h-11 coarse:h-11 flex-1 font-normal tabular-nums">
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/**
 * „Widok i kolumny” na telefonie: arkusz od dołu zamiast małego menu — układ z opisem,
 * kolumny tylko tam, gdzie mają sens (mozaika, siatka; na telefonie najwyżej 2), gęstość i grupowanie.
 */
export function ViewSheet({ open, onOpenChange, groupable = true }: { open: boolean; onOpenChange: (open: boolean) => void; groupable?: boolean }) {
  const prefs = useViewPrefs();
  const { propDefs } = useNotesContext();
  const columns: ColumnsChoice = prefs.autoColumns ? "auto" : prefs.columns <= 1 ? 1 : 2;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-border/60 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <SheetHeader className="text-left pr-10">
          <SheetTitle className="font-display">Widok</SheetTitle>
          <SheetDescription className="sr-only">Układ notatek, liczba kolumn, gęstość i grupowanie</SheetDescription>
        </SheetHeader>

        <Section title="Układ">
          <ToggleGroup
            variant="plain"
            aria-label="Układ"
            orientation="vertical"
            value={prefs.layout}
            onValueChange={(v) => changeView(() => setViewPref("layout", v as Layout))}
            className="flex flex-col gap-1"
          >
            {LAYOUTS.map((l) => {
              const on = prefs.layout === l.v;
              return (
                <ToggleGroupItem
                  key={l.v}
                  value={l.v}
                  className={cn(
                    "flex min-h-13 items-center gap-3 rounded-card px-3 py-2 text-left transition-colors duration-fast",
                    on ? "bg-primary/10" : "hover:bg-muted/60",
                  )}
                >
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-field", on ? "bg-primary/15 text-primary-ink" : "bg-muted text-muted-foreground")}>
                    <l.icon className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", on ? "font-semibold text-foreground" : "font-medium")}>{l.label}</span>
                    <span className="block text-xs text-muted-foreground">{l.hint}</span>
                  </span>
                  {on && <Check className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden />}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
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

        {groupable && (
          // Na telefonie nie ma menu „Sortuj wg” z komputera — bez tej sekcji własnych pól nie da się posortować.
          <Section title="Sortuj wg">
            <select
              aria-label="Sortuj wg"
              value={prefs.sortKey}
              onChange={(e) => setViewPref("sortKey", e.target.value as SortKey)}
              className="h-11 w-full rounded-field border border-input bg-background px-3 text-sm"
            >
              {sortOptions(propDefs).map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
            {prefs.sortKey !== "manual" && (
              <div className="mt-2">
                <Segmented label="Kierunek sortowania" options={DIRS} value={prefs.sortDir} onChange={(v) => setViewPref("sortDir", v)} />
              </div>
            )}
          </Section>
        )}

        {groupable && prefs.layout !== "board" && prefs.layout !== "table" && (
          <Section title="Grupuj">
            <Segmented label="Grupuj" options={GROUPS} value={prefs.groupBy} onChange={(v) => changeView(() => setViewPref("groupBy", v))} />
          </Section>
        )}
      </SheetContent>
    </Sheet>
  );
}
