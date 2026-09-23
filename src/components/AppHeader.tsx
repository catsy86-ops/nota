import { motion } from "framer-motion";
import { ChevronLeft, Moon, Sun, Download, FileJson, FileText, Upload, FolderOpen, Tag, Calendar } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SearchBar } from "@/components/SearchBar";
import { ViewControls } from "@/components/ViewControls";
import { cn } from "@/lib/utils";
import { useNotesContext } from "@/hooks/NotesProvider";
import { exportToJSON, exportToPDF, exportToMarkdown, exportToHTML } from "@/lib/exportNotes";
import { markBackup } from "@/lib/backupReminder";
import duckLogo from "@/assets/duck-logo.png";
import type { View } from "@/hooks/useFilteredNotes";

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
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggleSidebar}
                aria-label={sidebarOpen ? "Schowaj panel" : "Pokaż panel"}
                aria-pressed={sidebarOpen}
                className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground"
              >
                <ChevronLeft className={cn("w-5 h-5 transition-transform duration-300", !sidebarOpen && "rotate-180")} />
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {sidebarOpen ? "Schowaj panel" : "Pokaż panel"}
            </TooltipContent>
          </Tooltip>
          {!sidebarOpen && (
            <motion.img
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              src={duckLogo}
              alt="KACZY"
              className="w-7 h-7"
            />
          )}
          <div>
            <h1 className="text-lg font-display font-extrabold leading-tight tracking-tight bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
              {view === "notes" && "Notatki"}
              {view === "today" && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-primary" />
                  Dziś
                </span>
              )}
              {view === "week" && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-primary" />
                  Ten tydzień
                </span>
              )}
              {view === "archive" && "Archiwum"}
              {view === "reminders" && "Przypomnienia"}
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
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              {displayCount} {displayCount === 1 ? "notatka" : displayCount < 5 ? "notatki" : "notatek"}
            </p>
          </div>
        </div>

        <SearchBar value={search} onChange={onSearchChange} className="hidden sm:block" />

        <div className="flex items-center gap-1">
          {!sidebarOpen && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onToggleTheme}
              aria-label={dark ? "Włącz tryb jasny" : "Włącz tryb ciemny"}
              aria-pressed={dark}
              className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground"
            >
              {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </motion.button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground"
                aria-label="Import / Eksport"
                title="Import / Eksport"
              >
                <Download className="w-5 h-5" />
              </motion.button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5">
              <DropdownMenuItem onClick={() => { exportToJSON([...notes, ...archivedNotes]); markBackup(); }}>
                <FileJson className="w-4 h-4 mr-2" />
                Eksportuj jako JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToPDF(notes)}>
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

          <ViewControls allLabels={allLabels} />
        </div>
      </div>
    </header>
  );
}
