import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowDownAZ, ArrowUpAZ, Funnel, LayoutGrid, List, Columns2, SlidersHorizontal, Flag, Kanban, Table2 } from "lucide-react";
import { type Layout, type SortKey, type SortDir, type Density, useViewPrefs, setViewPref } from "@/lib/viewPrefs";
import { changeView } from "@/lib/viewChange";
import { colorClasses } from "@/components/ColorPicker";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/icon-button";
import type { NoteColor } from "@/hooks/useNotes";
import type { GroupBy } from "@/lib/groupNotes";
import { PRIORITY_LABELS, PRIORITY_COLOR_CLASS, type NotePriority } from "@/lib/notePriority";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNotesContext } from "@/hooks/NotesProvider";
import { sortOptions } from "@/lib/sortOptions";
import { ViewSheet } from "@/components/ViewSheet";
import { useRef, useState } from "react";

interface Props {
  allLabels: string[];
  /** `false` chowa menu sortowania (widok z własnym, stałym porządkiem). */
  sortable?: boolean;
}

const LAYOUTS: { v: Layout; label: string; icon: typeof LayoutGrid }[] = [
  { v: "masonry", label: "Mozaika", icon: LayoutGrid },
  { v: "grid", label: "Siatka", icon: Columns2 },
  { v: "list", label: "Lista", icon: List },
  { v: "board", label: "Tablica", icon: Kanban },
  { v: "table", label: "Tabela", icon: Table2 },
];

const GROUPS: { v: GroupBy; label: string }[] = [
  { v: "none", label: "Brak" },
  { v: "date", label: "Wg daty" },
  { v: "label", label: "Wg etykiety" },
  { v: "folder", label: "Wg folderu" },
];

const COLOR_OPTIONS: NoteColor[] = ["default", "coral", "peach", "sand", "mint", "sage", "sky", "lavender", "rose"];
const PRIORITY_OPTIONS: NotePriority[] = ["high", "medium", "low", "none"];

export function ViewControls({ allLabels, sortable = true }: Props) {
  const prefs = useViewPrefs();
  const { propDefs } = useNotesContext();
  const isMobile = useIsMobile();
  const [viewSheetOpen, setViewSheetOpen] = useState(false);
  const layoutTriggerRef = useRef<HTMLButtonElement>(null);

  const filtersActive = prefs.filterColor !== "all" || prefs.filterLabel !== "all" || prefs.filterHasReminder || prefs.filterPriority !== "all";
  const LayoutIcon = LAYOUTS.find((l) => l.v === prefs.layout)?.icon ?? LayoutGrid;

  return (
    // Kartka z lekkim cieniem zamiast szarej plamy — grupa ikon siedzi na papierze jak przycisk w zeszycie.
    <div className="flex items-center gap-0.5 p-0.5 sm:p-1 rounded-2xl bg-card/80 border border-border/60 shadow-elevation-1">
      {/* Layout — na telefonie arkusz od dołu z opisanymi opcjami, na desktopie menu */}
      {isMobile ? (
        <>
          <IconButton tone="segment" aria-label="Widok i kolumny" aria-haspopup="dialog" onClick={() => setViewSheetOpen(true)}>
            <LayoutIcon className="w-5 h-5" />
          </IconButton>
          <ViewSheet open={viewSheetOpen} onOpenChange={setViewSheetOpen} groupable={sortable} />
        </>
      ) : (
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <IconButton ref={layoutTriggerRef} tone="segment" aria-label="Widok i kolumny">
                <LayoutIcon className="w-5 h-5" />
              </IconButton>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Widok i kolumny</TooltipContent>
        </Tooltip>
        {/* Fokus wraca na przycisk bez przewijania — inaczej po zmianie układu (`changeView`
            zachowuje miejsce na liście) strona odjeżdżała do nagłówka. */}
        <DropdownMenuContent align="end" className="w-56" onCloseAutoFocus={(e) => { e.preventDefault(); layoutTriggerRef.current?.focus({ preventScroll: true }); }}>
          <DropdownMenuLabel className="text-2xs uppercase tracking-wider">Układ</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={prefs.layout} onValueChange={(v) => changeView(() => setViewPref("layout", v as Layout))}>
            {LAYOUTS.map((l) => (
              <DropdownMenuRadioItem key={l.v} value={l.v}>
                <l.icon className="w-3.5 h-3.5 mr-2" /> {l.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-2xs uppercase tracking-wider">Gęstość</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={prefs.density} onValueChange={(v) => changeView(() => setViewPref("density", v as Density))}>
            <DropdownMenuRadioItem value="compact">Kompakt</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="cozy">Komfort</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="comfy">Luźno</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          {(prefs.layout === "masonry" || prefs.layout === "grid") && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-2xs uppercase tracking-wider">Kolumny</DropdownMenuLabel>
              {/* Na telefonie mieszczą się najwyżej 2 kolumny — 3 i 4 dawały tam to samo co 2, więc ich nie ma. */}
              <div className="px-2 pb-2 flex items-center gap-1" role="group" aria-label="Liczba kolumn">
                <button
                  onClick={() => changeView(() => setViewPref("autoColumns", true))}
                  aria-pressed={prefs.autoColumns}
                  className={cn("flex-1 text-xs h-8 coarse:h-11 rounded-md", prefs.autoColumns ? "bg-primary/15 text-primary-ink font-semibold" : "hover:bg-muted text-muted-foreground")}
                >
                  Auto
                </button>
                {[1, 2, 3, 4].map((c) => (
                  <button
                    key={c}
                    onClick={() => changeView(() => { setViewPref("autoColumns", false); setViewPref("columns", c); })}
                    aria-pressed={!prefs.autoColumns && prefs.columns === c}
                    aria-label={c === 1 ? "1 kolumna" : `${c} kolumny`}
                    className={cn("flex-1 text-xs h-8 coarse:h-11 rounded-md tabular-nums", c > 2 && "max-sm:hidden", !prefs.autoColumns && prefs.columns === c ? "bg-primary/15 text-primary-ink font-semibold" : "hover:bg-muted text-muted-foreground")}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      )}

      {/* Sort — ukryte w agendzie przypomnień, która zawsze idzie po terminie */}
      {sortable && (
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <IconButton tone="segment" aria-label="Sortowanie">
                {prefs.sortDir === "asc" ? <ArrowUpAZ className="w-5 h-5" /> : <ArrowDownAZ className="w-5 h-5" />}
              </IconButton>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Sortowanie</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-2xs uppercase tracking-wider">Sortuj wg</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={prefs.sortKey} onValueChange={(v) => setViewPref("sortKey", v as SortKey)}>
            {sortOptions(propDefs).map((s) => (
              <DropdownMenuRadioItem key={s.v} value={s.v}>{s.label}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {prefs.sortKey !== "manual" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={prefs.sortDir} onValueChange={(v) => setViewPref("sortDir", v as SortDir)}>
                <DropdownMenuRadioItem value="desc">Malejąco</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="asc">Rosnąco</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-2xs uppercase tracking-wider">Grupuj</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={prefs.groupBy} onValueChange={(v) => changeView(() => setViewPref("groupBy", v as GroupBy))}>
            {GROUPS.map((g) => (
              <DropdownMenuRadioItem key={g.v} value={g.v}>{g.label}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      )}

      {/* Filter */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <IconButton tone={filtersActive ? "active" : "segment"} aria-label="Filtry">
                <Funnel className="w-5 h-5" />
                {filtersActive && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </IconButton>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Filtry</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="text-2xs uppercase tracking-wider">Kolor</DropdownMenuLabel>
          <div className="px-2 pb-2 flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setViewPref("filterColor", "all")}
              className={cn("text-2xs px-2 py-1 rounded-md transition-colors", prefs.filterColor === "all" ? "bg-primary/15 text-primary-ink font-semibold" : "hover:bg-muted text-muted-foreground")}
            >
              wszystkie
            </button>
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => setViewPref("filterColor", c)}
                data-swatch={c}
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-all",
                  colorClasses[c],
                  prefs.filterColor === c ? "border-primary scale-110 ring-2 ring-primary/20" : "border-border/50 hover:scale-105"
                )}
                title={c}
              />
            ))}
          </div>
          {allLabels.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-2xs uppercase tracking-wider">Etykieta</DropdownMenuLabel>
              <div className="max-h-40 overflow-y-auto">
                <DropdownMenuRadioGroup value={prefs.filterLabel} onValueChange={(v) => setViewPref("filterLabel", v)}>
                  <DropdownMenuRadioItem value="all">Wszystkie</DropdownMenuRadioItem>
                  {allLabels.map((l) => (
                    <DropdownMenuRadioItem key={l} value={l}>{l}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </div>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-2xs uppercase tracking-wider">Priorytet</DropdownMenuLabel>
          <div className="px-2 pb-2 grid grid-cols-3 gap-1">
            <button
              onClick={() => setViewPref("filterPriority", "all")}
              className={cn("text-2xs px-2 py-1 rounded-md transition-colors", prefs.filterPriority === "all" ? "bg-primary/15 text-primary-ink font-semibold" : "hover:bg-muted text-muted-foreground")}
            >
              wszystkie
            </button>
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p}
                onClick={() => setViewPref("filterPriority", p)}
                className={cn(
                  "flex items-center justify-center gap-1 text-2xs px-2 py-1 rounded-md transition-colors",
                  prefs.filterPriority === p ? "bg-primary/15 text-primary-ink font-semibold" : "hover:bg-muted text-muted-foreground"
                )}
              >
                {p !== "none" && <Flag className={cn("w-2.5 h-2.5 fill-current", PRIORITY_COLOR_CLASS[p])} />}
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={prefs.filterHasReminder}
            onCheckedChange={(v) => setViewPref("filterHasReminder", !!v)}
          >
            Tylko z przypomnieniem
          </DropdownMenuCheckboxItem>
          {(prefs.filterColor !== "all" || prefs.filterLabel !== "all" || prefs.filterHasReminder || prefs.filterPriority !== "all") && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setViewPref("filterColor", "all");
                  setViewPref("filterLabel", "all");
                  setViewPref("filterHasReminder", false);
                  setViewPref("filterPriority", "all");
                }}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 mr-2" /> Wyczyść filtry
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
