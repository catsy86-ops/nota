import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDroppable } from "@dnd-kit/core";
import {
  Settings as SettingsIcon, HelpCircle, Tag, Moon, Sun, FolderOpen, Command, History, Trophy, Brain, MoreHorizontal, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotesContext } from "@/hooks/NotesProvider";
import { SidebarLabelItem } from "@/components/sidebar/SidebarLabelItem";
import { SidebarFolderItem } from "@/components/sidebar/SidebarFolderItem";
import { SidebarAddFolderButton } from "@/components/sidebar/SidebarAddFolderButton";
import { SettingsDialog } from "@/components/SettingsDialog";
import { InstallAppButton } from "@/components/InstallAppButton";
import { BeerMugLogo } from "@/components/BeerMugLogo";
import type { View } from "@/hooks/useFilteredNotes";

function DroppableNavItem({ droppableId, children }: { droppableId?: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId || "noop", disabled: !droppableId });
  if (!droppableId) return <>{children}</>;
  return (
    <div ref={setNodeRef} data-folder-drop-root={droppableId === "notes-drop-root" ? "" : undefined} className={cn("rounded-xl transition-all duration-200", isOver && "ring-2 ring-primary/50 bg-primary/5 scale-[1.02]")}>
      {children}
    </div>
  );
}

interface SidebarItem {
  icon: React.ElementType;
  label: string;
  view: View;
  count?: number;
  emoji: string;
}

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
  view: View;
  activeLabel: string | null;
  activeFolder: string | null;
  onGoView: (view: View) => void;
  onGoLabel: (label: string) => void;
  onGoFolder: (folderId: string) => void;
  sidebarItems: SidebarItem[];
  onLogoClick: () => void;
  dark: boolean;
  onToggleTheme: () => void;
  onOpenPalette: () => void;
  onOpenActions: () => void;
  onOpenStats: () => void;
  onOpenFocusMode: () => void;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
}

export function AppSidebar({
  open, onClose, view, activeLabel, activeFolder, onGoView, onGoLabel, onGoFolder,
  sidebarItems, onLogoClick, dark, onToggleTheme, onOpenPalette, onOpenActions,
  onOpenStats, onOpenFocusMode, settingsOpen, onSettingsOpenChange,
}: AppSidebarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const { allLabels, folders, renameLabel, removeLabel, addFolder, updateFolder, deleteFolder } = useNotesContext();

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, width: 280, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="shrink-0 border-r border-border/50 sidebar-gradient overflow-hidden fixed left-0 top-0 bottom-0 z-50 shadow-2xl md:relative md:shadow-none"
          >
            <div className="p-5 space-y-1 w-[280px] h-full flex flex-col scrollbar-thin overflow-y-auto">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-3 px-3 pb-6"
              >
                <motion.button
                  type="button"
                  onClick={onLogoClick}
                  whileTap={{ scale: 0.94 }}
                  className="relative shrink-0 grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-transparent ring-1 ring-border/60"
                  aria-label="Notatki Pijackie"
                >
                  <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-lg opacity-70 -z-10" />
                  <motion.div>
                    <BeerMugLogo />
                  </motion.div>
                </motion.button>
                <div>
                  <h1 className="text-xl font-display font-extrabold gradient-text leading-tight tracking-tight">NOTATKI PIJACKIE</h1>
                  <p className="text-2xs text-muted-foreground font-medium">Notuj, zanim zapomnisz 🍺</p>
                </div>
              </motion.div>

              {/* Kafle statystyk usunięte — liczniki są już przy pozycjach nawigacji. */}
              <div className="space-y-0.5">
                {sidebarItems.map((item, i) => {
                  const isNotesItem = item.view === "notes";
                  const active = view === item.view && view !== "label";
                  return (
                    <DroppableNavItem key={item.view} droppableId={isNotesItem ? "notes-drop-root" : undefined}>
                      <motion.button
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.15 + i * 0.05 }}
                        onClick={() => onGoView(item.view)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative w-full flex items-center gap-3 px-3 h-9 rounded-lg text-sm font-medium transition-colors duration-200",
                          active ? "text-primary" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                        )}
                      >
                        {active && (
                          <>
                            <motion.span
                              layoutId="sidebar-active-pill"
                              className="absolute inset-0 rounded-lg bg-primary/10"
                              transition={{ type: "spring", stiffness: 500, damping: 38 }}
                            />
                          </>
                        )}
                        <item.icon className="w-[18px] h-[18px] relative z-10" />
                        <span className="flex-1 text-left relative z-10">{item.label}</span>
                        {item.count !== undefined && item.count > 0 && (
                          <motion.span
                            key={item.count}
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            className={cn(
                              "relative z-10 text-2xs font-semibold px-2 py-0.5 rounded-full min-w-[22px] text-center",
                              active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                            )}
                          >
                            {item.count}
                          </motion.span>
                        )}
                      </motion.button>
                    </DroppableNavItem>
                  );
                })}
              </div>

              {allLabels.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="pt-5"
                >
                  <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-2 flex items-center gap-1.5">
                    <Tag className="w-3 h-3" />
                    Etykiety
                  </p>
                  <div className="space-y-0.5">
                    {allLabels.map((label) => (
                      <SidebarLabelItem
                        key={label}
                        label={label}
                        isActive={view === "label" && activeLabel === label}
                        onSelect={() => onGoLabel(label)}
                        onRename={(newName) => renameLabel(label, newName)}
                        onDelete={() => removeLabel(label)}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="pt-5"
              >
                <div className="flex items-center justify-between px-3 mb-2">
                  <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FolderOpen className="w-3 h-3" />
                    Foldery
                  </p>
                  <SidebarAddFolderButton onAdd={(name) => addFolder(name)} />
                </div>
                <div className="space-y-0.5">
                  {folders.filter((f) => !f.parentId).map((folder) => (
                    <SidebarFolderItem
                      key={folder.id}
                      folder={folder}
                      folders={folders}
                      isActive={view === "folder" && activeFolder === folder.id}
                      activeFolderId={activeFolder}
                      view={view}
                      onSelect={onGoFolder}
                      onRename={(id, name) => updateFolder(id, { name })}
                      onDelete={(id) => deleteFolder(id)}
                      onSetColor={(id, color) => updateFolder(id, { color })}
                      onSetEmoji={(id, emoji) => updateFolder(id, { emoji })}
                      onAddSubfolder={(parentId, name) => addFolder(name, parentId)}
                    />
                  ))}
                </div>
              </motion.div>

              <div className="flex-1" />

              <div className="px-1 pb-2 pt-4 border-t border-border/50 space-y-0.5">
                <button onClick={onOpenPalette} className="w-full flex items-center gap-3 px-3 h-9 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors">
                  <Command className="w-[18px] h-[18px]" />
                  <span>Paleta poleceń</span>
                  <span className="ml-auto text-2xs opacity-70">⌘K</span>
                </button>
                <button
                  onClick={onToggleTheme}
                  aria-label={dark ? "Włącz tryb jasny" : "Włącz tryb ciemny"}
                  aria-pressed={dark}
                  className="w-full flex items-center gap-3 px-3 h-9 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
                >
                  {dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
                  <span>{dark ? "Tryb jasny" : "Tryb ciemny"}</span>
                </button>
                <SettingsDialog open={settingsOpen} onOpenChange={onSettingsOpenChange} />
                <button onClick={() => onSettingsOpenChange(true)} className="w-full flex items-center gap-3 px-3 h-9 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors">
                  <SettingsIcon className="w-[18px] h-[18px]" />
                  <span>Ustawienia</span>
                </button>

                {/* Akcje drugorzędne zwinięte — sidebar ma się mieścić na 900 px. */}
                <button
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-expanded={moreOpen}
                  className="w-full flex items-center gap-3 px-3 h-9 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
                >
                  <MoreHorizontal className="w-[18px] h-[18px]" />
                  <span>Narzędzia</span>
                  <ChevronDown className={cn("ml-auto w-4 h-4 transition-transform", moreOpen && "rotate-180")} />
                </button>
                {moreOpen && (
                  <div className="space-y-0.5 pl-2">
                    <button onClick={onOpenActions} className="w-full flex items-center gap-3 px-3 h-9 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors">
                      <History className="w-[18px] h-[18px]" />
                      <span>Ostatnie akcje</span>
                    </button>
                    <button onClick={onOpenStats} className="w-full flex items-center gap-3 px-3 h-9 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors">
                      <Trophy className="w-[18px] h-[18px]" />
                      <span>Statystyki</span>
                    </button>
                    <button onClick={onOpenFocusMode} className="w-full flex items-center gap-3 px-3 h-9 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors">
                      <Brain className="w-[18px] h-[18px]" />
                      <span>Tryb skupienia</span>
                    </button>
                    <button onClick={() => window.dispatchEvent(new CustomEvent("kaczy:tour"))} className="w-full flex items-center gap-3 px-3 h-9 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors">
                      <HelpCircle className="w-[18px] h-[18px]" />
                      <span>Samouczek</span>
                    </button>
                  </div>
                )}
                <InstallAppButton />
                <p className="text-2xs text-muted-foreground/40 text-center font-medium">NOTATKI PIJACKIE v1.0 • Zrobione przy piwie 🍺</p>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
