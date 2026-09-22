import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { ArrowDownAZ, ArrowUpAZ, Filter, LayoutGrid, List, Rows3, Columns2, SlidersHorizontal } from "lucide-react";
import { type Layout, type SortKey, type SortDir, type Density, useViewPrefs, setViewPref } from "@/lib/viewPrefs";
import { colorClasses } from "@/components/ColorPicker";
import { cn } from "@/lib/utils";
import type { NoteColor } from "@/hooks/useNotes";

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
];

const COLOR_OPTIONS: NoteColor[] = ["default", "coral", "peach", "sand", "mint", "sage", "sky", "lavender", "rose"];

export function ViewControls({ allLabels }: Props) {
  const prefs = useViewPrefs();

  return (
    <div className="flex items-center gap-1">
      {/* Layout */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground"
              >
                {prefs.layout === "list" ? <List className="w-5 h-5" /> : prefs.layout === "grid" ? <Columns2 className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Widok i kolumny</TooltipContent>
          </Tooltip>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
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
        <DropdownMenuTrigger asChild>
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground"
              >
                {prefs.sortDir === "asc" ? <ArrowUpAZ className="w-5 h-5" /> : <ArrowDownAZ className="w-5 h-5" />}
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Sortowanie</TooltipContent>
          </Tooltip>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Sortuj wg</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={prefs.sortKey} onValueChange={(v) => setViewPref("sortKey", v as SortKey)}>
            {SORTS.map((s) => (
              <DropdownMenuRadioItem key={s.v} value={s.v}>{s.label}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={prefs.sortDir} onValueChange={(v) => setViewPref("sortDir", v as SortDir)}>
            <DropdownMenuRadioItem value="desc">Malejąco</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="asc">Rosnąco</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "p-2 rounded-xl hover:bg-muted transition-colors",
                  (prefs.filterColor !== "all" || prefs.filterLabel !== "all" || prefs.filterHasReminder)
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground"
                )}
              >
                <Filter className="w-5 h-5" />
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Filtry</TooltipContent>
          </Tooltip>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">Kolor</DropdownMenuLabel>
          <div className="px-2 pb-2 flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setViewPref("filterColor", "all")}
              className={cn("text-[10px] px-2 py-1 rounded-md", prefs.filterColor === "all" ? "bg-primary/15 text-primary font-semibold" : "hover:bg-muted text-muted-foreground")}
            >
              wszystkie
            </button>
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => setViewPref("filterColor", c)}
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-transform",
                  colorClasses[c],
                  prefs.filterColor === c ? "border-primary scale-110" : "border-border/50"
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
          <DropdownMenuCheckboxItem
            checked={prefs.filterHasReminder}
            onCheckedChange={(v) => setViewPref("filterHasReminder", !!v)}
          >
            Tylko z przypomnieniem
          </DropdownMenuCheckboxItem>
          {(prefs.filterColor !== "all" || prefs.filterLabel !== "all" || prefs.filterHasReminder) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setViewPref("filterColor", "all");
                  setViewPref("filterLabel", "all");
                  setViewPref("filterHasReminder", false);
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
