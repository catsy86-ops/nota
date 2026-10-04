import { motion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen, Moon, Sun, Download, FileJson, FileText, Upload, FolderOpen, Tag } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SearchBar } from "@/components/SearchBar";
import { ViewControls } from "@/components/ViewControls";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/icon-button";
import { tween } from "@/lib/motion";
import { useNotesContext } from "@/hooks/NotesProvider";
import { exportToJSON, exportToMarkdown, exportToHTML } from "@/lib/exportNotes";
import { markBackup } from "@/lib/backupReminder";
import { NotkiLogo } from "@/components/NotkiLogo";
import type { View } from "@/hooks/useFilteredNotes";
import { pluralPl } from "@/lib/plural";

interface AppHeaderProps {
  hideHeader: boolean;
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
  hideHeader, selectionMode, sidebarOpen, onToggleSidebar, dark, onToggleTheme,
  view, activeFolder, activeLabel, displayCount, search, onSearchChange, onImport,
}: AppHeaderProps) {
  const { notes, archivedNotes, folders, allLabels } = useNotesContext();

  return (
    <header
      className={cn(
        "sticky top-0 z-30 glass header-glow border-b border-border/50 transition-transform duration-300 ease-out will-change-transform motion-reduce:transition-none",
        hideHeader && !selectionMode ? "-translate-y-full" : "translate-y-0"
      )}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
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
          {/* Na telefonie brakuje miejsca na logo i tytuł naraz: w Notatkach
              logo jest tytułem, w pozostałych widokach zostaje sam tytuł. */}
          {!sidebarOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className={view === "notes" ? undefined : "hidden sm:block"}
            >
              <NotkiLogo size="sm" />
            </motion.div>
          )}
          {!sidebarOpen && <span aria-hidden className="hidden sm:block h-5 w-px bg-border" />}
          <div className={!sidebarOpen && view === "notes" ? "hidden sm:block" : undefined}>
            <h1 className="text-lg font-display font-extrabold leading-tight tracking-tight text-foreground">
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
              {view === "archive" && "Archiwum"}
              {view === "reminders" && "Przypomnienia"}
              {view === "trash" && "Kosz"}
              {view === "folder" && (
                <span className="flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-primary" />
                  {folders.find((f) => f.id === activeFolder)?.name || "Folder"}
                </span>
              )}
              {view === "label" && (
                <span className="flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-primary" />
                  {activeLabel}
                </span>
              )}
            </h1>
            {view !== "calendar" && (
              <p className="text-xs text-muted-foreground hidden sm:block">
                {displayCount} {pluralPl(displayCount, ["notatka", "notatki", "notatek"])}
              </p>
            )}
          </div>
        </div>

        <SearchBar value={search} onChange={onSearchChange} className="hidden sm:block" />

        <div className="flex items-center gap-1">
          {!sidebarOpen && (
            <IconButton asChild className="hidden sm:inline-flex">
              <motion.button
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={tween.enter}
                onClick={onToggleTheme}
                aria-label={dark ? "Włącz tryb jasny" : "Włącz tryb ciemny"}
                aria-pressed={dark}
              >
                {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </motion.button>
            </IconButton>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton aria-label="Import / Eksport" title="Import / Eksport">
                <Download className="w-5 h-5" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => { void exportToJSON([...notes, ...archivedNotes]).then(markBackup); }}>
                <FileJson className="w-4 h-4 mr-2" />
                Eksportuj jako JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { import("@/lib/exportPdf").then((m) => m.exportToPDF([...notes, ...archivedNotes])); }}>
                <FileText className="w-4 h-4 mr-2" />
                Eksportuj jako PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToMarkdown([...notes, ...archivedNotes])}>
                <FileText className="w-4 h-4 mr-2" />
                Eksportuj jako Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToHTML([...notes, ...archivedNotes])}>
                <FileText className="w-4 h-4 mr-2" />
                Eksportuj jako HTML
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onImport}>
                <Upload className="w-4 h-4 mr-2" />
                Importuj z JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* W kalendarzu układ, sortowanie i filtry notatek nie robią nic —
              kalendarz rysuje własną projekcję terminów. Poza tym, że kontrolki
              tam kłamią, na 320 px rozpychały nagłówek w poziomie. */}
          {view !== "calendar" && <ViewControls allLabels={allLabels} sortable={view !== "reminders"} />}
        </div>
      </div>
    </header>
  );
}
