import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { ArrowDownAZ, ArrowUpAZ, Filter, LayoutGrid, List, Columns2, SlidersHorizontal, Flag } from "lucide-react";
import { type Layout, type SortKey, type SortDir, type Density, useViewPrefs, setViewPref } from "@/lib/viewPrefs";
import { colorClasses } from "@/components/ColorPicker";
import { cn } from "@/lib/utils";
import type { NoteColor } from "@/hooks/useNotes";
import { PRIORITY_LABELS, PRIORITY_COLOR_CLASS, type NotePriority } from "@/lib/notePriority";

interface Props {
  allLabels: string[];
}

const LAYOUTS: { v: Layout; label: string; icon: typeof LayoutGrid }[] = [
  { v: "masonry", label: "Masonry", icon: LayoutGrid },
  { v: "grid", label: "Siatka", icon: Columns2 },
  { v: "list", label: "Lista", icon: List },
];

const SORTS: { v: SortKey; label: string }[] = [
  { v: "updated", label: "Data modyfikacji" },
  { v: "created", label: "Data utworzenia" },
  { v: "title", label: "Tytuł (A-Z)" },
  { v: "color", label: "Kolor" },
  { v: "priority", label: "Priorytet" },
  { v: "manual", label: "Ręcznie (przeciągnij)" },
];

const COLOR_OPTIONS: NoteColor[] = ["default", "coral", "peach", "sand", "mint", "sage", "sky", "lavender", "rose"];
const PRIORITY_OPTIONS: NotePriority[] = ["high", "medium", "low", "none"];

export function ViewControls({ allLabels }: Props) {
  const prefs = useViewPrefs();

  const filtersActive = prefs.filterColor !== "all" || prefs.filterLabel !== "all" || prefs.filterHasReminder || prefs.filterPriority !== "all";

  return (
    <div className="flex items-center gap-0.5 p-1 rounded-2xl bg-muted/40 border border-border/50">
      {/* Layout */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-xl hover:bg-background hover:shadow-sm transition-colors text-muted-foreground data-[state=open]:bg-background data-[state=open]:text-foreground data-[state=open]:shadow-sm"
              >
                {prefs.layout === "list" ? <List className="w-5 h-5" /> : prefs.layout === "grid" ? <Columns2 className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
              </motion.button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Widok i kolumny</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Układ</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={prefs.layout} onValueChange={(v) => setViewPref("layout", v as Layout)}>
            {LAYOUTS.map((l) => (
              <DropdownMenuRadioItem key={l.v} value={l.v}>
                <l.icon className="w-3.5 h-3.5 mr-2" /> {l.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Gęstość</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={prefs.density} onValueChange={(v) => setViewPref("density", v as Density)}>
            <DropdownMenuRadioItem value="compact">Kompakt</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="cozy">Komfort</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="comfy">Luźno</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          {prefs.layout !== "list" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Kolumny</DropdownMenuLabel>
              <div className="px-2 pb-2 flex items-center gap-1">
                <button
                  onClick={() => setViewPref("autoColumns", true)}
                  className={cn("flex-1 text-xs py-1 rounded-md", prefs.autoColumns ? "bg-primary/15 text-primary font-semibold" : "hover:bg-muted text-muted-foreground")}
                >
                  Auto
                </button>
                {[1, 2, 3, 4].map((c) => (
                  <button
                    key={c}
                    onClick={() => { setViewPref("autoColumns", false); setViewPref("columns", c); }}
                    className={cn("w-7 text-xs py-1 rounded-md", !prefs.autoColumns && prefs.columns === c ? "bg-primary/15 text-primary font-semibold" : "hover:bg-muted text-muted-foreground")}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-xl hover:bg-background hover:shadow-sm transition-colors text-muted-foreground data-[state=open]:bg-background data-[state=open]:text-foreground data-[state=open]:shadow-sm"
              >
                {prefs.sortDir === "asc" ? <ArrowUpAZ className="w-5 h-5" /> : <ArrowDownAZ className="w-5 h-5" />}
              </motion.button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Sortowanie</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Sortuj wg</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={prefs.sortKey} onValueChange={(v) => setViewPref("sortKey", v as SortKey)}>
            {SORTS.map((s) => (
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
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Filter */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "relative p-2 rounded-xl transition-colors",
                  filtersActive
                    ? "text-primary bg-primary/10 shadow-sm"
                    : "text-muted-foreground hover:bg-background hover:shadow-sm data-[state=open]:bg-background data-[state=open]:text-foreground data-[state=open]:shadow-sm"
                )}
              >
                <Filter className="w-5 h-5" />
                {filtersActive && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </motion.button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Filtry</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-60 rounded-2xl p-1.5">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Kolor</DropdownMenuLabel>
          <div className="px-2 pb-2 flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setViewPref("filterColor", "all")}
              className={cn("text-[10px] px-2 py-1 rounded-md transition-colors", prefs.filterColor === "all" ? "bg-primary/15 text-primary font-semibold" : "hover:bg-muted text-muted-foreground")}
            >
              wszystkie
            </button>
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => setViewPref("filterColor", c)}
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
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Etykieta</DropdownMenuLabel>
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
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Priorytet</DropdownMenuLabel>
          <div className="px-2 pb-2 flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setViewPref("filterPriority", "all")}
              className={cn("text-[10px] px-2 py-1 rounded-md transition-colors", prefs.filterPriority === "all" ? "bg-primary/15 text-primary font-semibold" : "hover:bg-muted text-muted-foreground")}
            >
              wszystkie
            </button>
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p}
                onClick={() => setViewPref("filterPriority", p)}
                className={cn(
                  "flex items-center gap-1 text-[10px] px-2 py-1 rounded-md transition-colors",
                  prefs.filterPriority === p ? "bg-primary/15 text-primary font-semibold" : "hover:bg-muted text-muted-foreground"
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
