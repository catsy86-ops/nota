import { useEffect, useRef } from "react";
import { AnimatePresence, m as motion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen, Moon, Sun, FileDown, FolderOpen, Tag } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SearchBar } from "@/components/SearchBar";
import { ViewControls } from "@/components/ViewControls";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/icon-button";
import { tween } from "@/lib/motion";
import { useNotesContext } from "@/hooks/NotesProvider";
import { ImportExportMenu } from "@/components/ImportExportMenu";
import { NotkiLogo } from "@/components/NotkiLogo";
import { NMonogramLogo } from "@/components/NMonogramLogo";
import type { View } from "@/hooks/useFilteredNotes";
import { pluralPl } from "@/lib/plural";
import { RollingNumber } from "@/components/RollingNumber";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";
import { isTitleBlockView } from "@/components/ViewTitle";

interface AppHeaderProps {
  selectionMode: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  dark: boolean;
  onToggleTheme: () => void;
  view: View;
  activeFolder: string | null;
  activeLabel: string | null;
  displayCount: number;
  search: string;
  onSearchChange: (v: string) => void;
  onImport: () => void;
}

export function AppHeader({
  selectionMode, sidebarOpen, onToggleSidebar, dark, onToggleTheme,
  view, activeFolder, activeLabel, displayCount, search, onSearchChange, onImport,
}: AppHeaderProps) {
  // Stan tutaj, nie w Index: schowanie nagłówka przerysowuje tylko nagłówek, a nie całą stronę z kartami.
  const hideHeader = useHideOnScroll(96);
  const { folders, allLabels } = useNotesContext();
  const hidden = hideHeader && !selectionMode;
  const headerRef = useRef<HTMLElement>(null);

  // Dla elementów przyklejonych pod nagłówkiem (pasek kolumn tablicy): wysokość nagłówka
  // w `--app-header-h` i klasa `header-hidden` na <html>, gdy nagłówek jest schowany.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty("--app-header-h", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => { ro.disconnect(); root.style.removeProperty("--app-header-h"); };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("header-hidden", hidden);
    return () => document.documentElement.classList.remove("header-hidden");
  }, [hidden]);

  return (
    <header
      ref={headerRef}
      className={cn(
        "app-header sticky top-0 z-30 glass header-glow border-b border-border/50 transition-transform duration-base ease-out will-change-transform motion-reduce:transition-none",
        hidden ? "-translate-y-full" : "translate-y-0"
      )}
    >
      {/* Stała wysokość: bez kontrolek widoku (kalendarz, grafik) nagłówek nie skacze przy przejściu. */}
      <div className="max-w-352 mx-auto px-4 sm:px-6 py-3 min-h-[66px] sm:min-h-[70px] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                onClick={onToggleSidebar}
                aria-label={sidebarOpen ? "Schowaj panel" : "Pokaż panel"}
                aria-pressed={sidebarOpen}
              >
                {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
              </IconButton>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {sidebarOpen ? "Schowaj panel" : "Pokaż panel"}
            </TooltipContent>
          </Tooltip>
          {/* Na telefonie: animowany monogram „h” zawsze (w każdym widoku); pełny napis „hydra” tylko tam,
              gdzie jest miejsce — w Notatkach. Na komputerze całość jak dotąd. */}
          {!sidebarOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className={view === "notes" ? undefined : "flex sm:block max-[359px]:hidden"}
            >
              <span className="logo-intro flex items-center gap-1">
                <NMonogramLogo className="w-6 h-6" />
                {view === "notes" ? <NotkiLogo size="sm" /> : <span className="max-sm:hidden"><NotkiLogo size="sm" /></span>}
              </span>
            </motion.div>
          )}
          {!sidebarOpen && <span aria-hidden className="hidden sm:block h-5 w-px bg-border" />}
          <div className={!sidebarOpen && view === "notes" ? "hidden sm:block" : "min-w-0"}>
            <h1 className={cn("app-title truncate text-lg font-display leading-tight tracking-tight text-foreground", isTitleBlockView(view) && "hidden")}>
              {view === "notes" && "Notatki"}
              {view === "today" && (
"Dziś"
              )}
              {view === "week" && (
"Ten tydzień"
              )}
              {view === "calendar" && (
"Kalendarz"
              )}
              {view === "shifts" && "Grafik"}
              {view === "study" && "Praca"}
              {view === "debts" && "Długi"}
              {view === "cwiczenia" && "Ćwiczenia"}
              {view === "archive" && "Archiwum"}
              {view === "reminders" && "Terminy"}
              {view === "trash" && "Kosz"}
              {view === "folder" && (
                <span className="flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-primary-ink" />
                  {folders.find((f) => f.id === activeFolder)?.name || "Folder"}
                </span>
              )}
              {view === "label" && (
                <span className="flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-primary-ink" />
                  {activeLabel}
                </span>
              )}
            </h1>
            {view !== "calendar" && view !== "shifts" && view !== "study" && view !== "debts" && view !== "cwiczenia" && (
              <p className="text-xs text-muted-foreground hidden sm:block">
                <RollingNumber value={displayCount} /> {pluralPl(displayCount, ["notatka", "notatki", "notatek"])}
              </p>
            )}
          </div>
        </div>

        {/* Grafik i Kalendarz nie przeszukują notatek — pole tylko by udawało, że działa. */}
        {view !== "shifts" && view !== "calendar" && view !== "study" && view !== "debts" && view !== "cwiczenia" && <SearchBar value={search} onChange={onSearchChange} className="hidden sm:block" />}

        <div className="flex items-center gap-1">
          {!sidebarOpen && (
            <IconButton asChild className="hidden sm:inline-flex">
              <motion.button
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={tween.enter}
                onClick={onToggleTheme}
                aria-label="Tryb ciemny"
                aria-pressed={dark}
              >
                {/* Słońce i księżyc zamieniają się obrotem — ikona mówi, co się stanie po kliknięciu. */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={dark ? "sun" : "moon"}
                    initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                    exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
                    transition={tween.enter}
                    className="inline-flex"
                  >
                    {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            </IconButton>
          )}

          {/* Na telefonie Import/Eksport jest w „Więcej” — nagłówek miał tam pięć ikon. */}
          <ImportExportMenu onImport={onImport}>
            <IconButton aria-label="Import / Eksport" title="Import / Eksport" className="hidden sm:inline-flex">
              <FileDown className="w-5 h-5" />
            </IconButton>
          </ImportExportMenu>

          {/* W kalendarzu układ, sortowanie i filtry notatek nie robią nic —
              kalendarz rysuje własną projekcję terminów. Poza tym, że kontrolki
              tam kłamią, na 320 px rozpychały nagłówek w poziomie. */}
          {view !== "calendar" && view !== "shifts" && view !== "study" && view !== "debts" && view !== "cwiczenia" && <ViewControls allLabels={allLabels} sortable={view !== "reminders"} />}
        </div>
      </div>
    </header>
  );
}
