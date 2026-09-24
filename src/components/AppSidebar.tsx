import { motion, AnimatePresence } from "framer-motion";
import { useDroppable } from "@dnd-kit/core";
import {
  Settings as SettingsIcon, HelpCircle, Tag, Moon, Sun, Keyboard, FolderOpen, Command, History, Trophy,
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
  totalNotes: number;
  remindersCount: number;
  onLogoClick: () => void;
  dark: boolean;
  onToggleTheme: () => void;
  onOpenPalette: () => void;
  onOpenActions: () => void;
  onOpenStats: () => void;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
}

export function AppSidebar({
  open, onClose, view, activeLabel, activeFolder, onGoView, onGoLabel, onGoFolder,
  sidebarItems, totalNotes, remindersCount, onLogoClick, dark, onToggleTheme, onOpenPalette, onOpenActions,
  onOpenStats, settingsOpen, onSettingsOpenChange,
}: AppSidebarProps) {
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
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  className="relative shrink-0 grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-transparent ring-1 ring-border/60"
                  aria-label="Notatki Pijackie"
                >
                  <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-lg opacity-70 -z-10" />
                  <motion.div whileHover={{ rotate: [0, -12, 12, -6, 0], transition: { duration: 0.5 } }}>
                    <BeerMugLogo />
                  </motion.div>
                </motion.button>
                <div>
                  <h1 className="text-xl font-display font-extrabold gradient-text leading-tight tracking-tight">NOTATKI PIJACKIE</h1>
                  <p className="text-[10px] text-muted-foreground font-medium">Notuj, zanim zapomnisz 🍺</p>
                </div>
              </motion.div>

              <div className="grid grid-cols-3 gap-2 px-1 pb-4">
                {[
                  { value: totalNotes, label: "Notatek", color: "" },
                  { value: allLabels.length, label: "Etykiet", color: "" },
                  { value: remindersCount, label: "Przyp.", color: "text-primary" },
                ].map((stat) => (
                  <motion.div
                    key={stat.label}
                    whileHover={{ scale: 1.03 }}
                    className="stats-card text-center"
                  >
                    <p className={cn("text-lg font-display font-bold", stat.color || "text-foreground")}>{stat.value}</p>
                    <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</p>
                  </motion.div>
                ))}
              </div>

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
                        whileHover={{ x: 3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onGoView(item.view)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200",
                          active ? "text-primary" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                        )}
                      >
                        {active && (
                          <>
                            <motion.span
                              layoutId="sidebar-active-pill"
                              className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/15 shadow-sm"
                              transition={{ type: "spring", stiffness: 500, damping: 38 }}
                            />
                            <motion.span
                              layoutId="sidebar-active-bar"
                              className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-primary"
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
                              "relative z-10 text-[10px] font-semibold px-2 py-0.5 rounded-full min-w-[22px] text-center",
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
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-2 flex items-center gap-1.5">
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
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
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

              <div className="px-1 pb-2 pt-4 border-t border-border/50 space-y-2">
                <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-muted-foreground/50">
                  <Keyboard className="w-3 h-3" />
                  <span>Ctrl+N • Ctrl+K — paleta</span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onOpenPalette}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all"
                >
                  <Command className="w-[18px] h-[18px]" />
                  <span>Paleta poleceń</span>
                  <span className="ml-auto text-[10px] opacity-60">⌘K</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onOpenActions}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all"
                >
                  <History className="w-[18px] h-[18px]" />
                  <span>Ostatnie akcje</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onOpenStats}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all"
                >
                  <Trophy className="w-[18px] h-[18px]" />
                  <span>Statystyki</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onToggleTheme}
                  aria-label={dark ? "Włącz tryb jasny" : "Włącz tryb ciemny"}
                  aria-pressed={dark}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all"
                >
                  <AnimatePresence mode="wait">
                    {dark ? (
                      <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                        <Sun className="w-[18px] h-[18px]" />
                      </motion.div>
                    ) : (
                      <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                        <Moon className="w-[18px] h-[18px]" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <span>{dark ? "Tryb jasny" : "Tryb ciemny"}</span>
                </motion.button>
                <SettingsDialog open={settingsOpen} onOpenChange={onSettingsOpenChange} />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSettingsOpenChange(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all"
                >
                  <SettingsIcon className="w-[18px] h-[18px]" />
                  <span>Ustawienia</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => window.dispatchEvent(new CustomEvent("kaczy:tour"))}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all"
                >
                  <HelpCircle className="w-[18px] h-[18px]" />
                  <span>Samouczek</span>
                </motion.button>
                <InstallAppButton />
                <p className="text-[10px] text-muted-foreground/40 text-center font-medium">NOTATKI PIJACKIE v1.0 • Zrobione przy piwie 🍺</p>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
