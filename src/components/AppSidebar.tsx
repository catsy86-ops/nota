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
import { SidebarRow, SidebarCount } from "@/components/sidebar/SidebarRow";
import { InstallAppButton } from "@/components/InstallAppButton";
import { BeerMugLogo } from "@/components/BeerMugLogo";
import { NotkiLogo } from "@/components/NotkiLogo";
import type { View } from "@/hooks/useFilteredNotes";
import { modShortcut } from "@/lib/platform";
import { useIsMobile } from "@/hooks/use-mobile";
import { dur, ease, tween } from "@/lib/motion";

// „Notatki” przyjmują upuszczoną notatkę (wyjęcie z folderu); pozostałe pozycje nie.
function NavRow({ item, active, onClick }: { item: SidebarItem; active: boolean; onClick: () => void }) {
  const droppableId = item.view === "notes" ? "notes-drop-root" : undefined;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId || `nav-${item.view}`, disabled: !droppableId });
  return (
    <div data-folder-drop-root={droppableId ? "" : undefined}>
      <SidebarRow
        ref={droppableId ? setNodeRef : undefined}
        icon={<item.icon className="w-[18px] h-[18px]" />}
        label={item.label}
        active={active}
        dropActive={isOver}
        onClick={onClick}
        trailing={item.count !== undefined && item.count > 0 ? <SidebarCount value={item.count} active={active} /> : undefined}
      />
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
  onSettingsOpenChange: (open: boolean) => void;
}

export function AppSidebar({
  open, onClose, view, activeLabel, activeFolder, onGoView, onGoLabel, onGoFolder,
  sidebarItems, onLogoClick, dark, onToggleTheme, onOpenPalette, onOpenActions,
  onOpenStats, onOpenFocusMode, onSettingsOpenChange,
}: AppSidebarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const isMobile = useIsMobile();
  const { allLabels, folders, renameLabel, removeLabel, addFolder, updateFolder, deleteFolder } = useNotesContext();

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: tween.enter }}
            exit={{ opacity: 0, transition: tween.exit }}
            className="fixed inset-0 z-40 bg-foreground/30 md:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.aside
            // Telefon: arkusz wjeżdża z krawędzi nad treścią. Desktop: pasek jest w układzie,
            // więc animujemy szerokość — treść odsuwa się razem z nim, zamiast skakać na końcu.
            initial={isMobile ? { x: "-100%" } : { width: 0 }}
            animate={isMobile ? { x: 0, transition: tween.enter } : { width: "17.5rem", transition: { duration: dur.slow, ease: ease.out } }}
            exit={isMobile ? { x: "-100%", transition: tween.exit } : { width: 0, transition: { duration: dur.base, ease: ease.in } }}
            className="shrink-0 max-w-[85vw] border-r border-border/50 sidebar-gradient overflow-hidden fixed left-0 top-0 bottom-0 z-50 shadow-2xl md:relative md:shadow-none"
          >
            <div className="p-5 space-y-1 w-[17.5rem] max-w-[85vw] h-full flex flex-col scrollbar-thin overflow-y-auto">
              <div className="flex items-center gap-3 px-3 pb-6">
                <button
                  type="button"
                  onClick={onLogoClick}
                  className="pressable relative shrink-0 grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-transparent ring-1 ring-border/60"
                  aria-label="NOTKI"
                >
                  <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-lg opacity-70 -z-10" />
                  <BeerMugLogo />
                </button>
                <div>
                  <h1 className="leading-none"><NotkiLogo /></h1>
                  <p className="text-2xs text-muted-foreground font-medium mt-1.5">Notuj, zanim zapomnisz 🍺</p>
                </div>
              </div>

              {/* Kafle statystyk usunięte — liczniki są już przy pozycjach nawigacji. */}
              <div className="space-y-0.5">
                {sidebarItems.map((item) => (
                  <NavRow
                    key={item.view}
                    item={item}
                    active={view === item.view && view !== "label"}
                    onClick={() => onGoView(item.view)}
                  />
                ))}
              </div>

              {allLabels.length > 0 && (
                <div className="pt-5">
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
                </div>
              )}

              <div className="pt-5">
                <div className="flex items-center justify-between pl-3 pr-1 mb-1 min-h-7">
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
              </div>

              <div className="flex-1" />

              <div className="px-1 pb-2 pt-4 border-t border-border/50 space-y-0.5">
                <SidebarRow
                  icon={<Command className="w-[18px] h-[18px]" />}
                  label="Paleta poleceń"
                  onClick={onOpenPalette}
                  trailing={<span className="shrink-0 text-2xs opacity-70">{modShortcut("K")}</span>}
                />
                <SidebarRow
                  icon={dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
                  label={dark ? "Tryb jasny" : "Tryb ciemny"}
                  onClick={onToggleTheme}
                  buttonProps={{ "aria-label": dark ? "Włącz tryb jasny" : "Włącz tryb ciemny", "aria-pressed": dark }}
                />
                <SidebarRow icon={<SettingsIcon className="w-[18px] h-[18px]" />} label="Ustawienia" onClick={() => onSettingsOpenChange(true)} />

                {/* Akcje drugorzędne zwinięte — sidebar ma się mieścić na 900 px. */}
                <SidebarRow
                  icon={<MoreHorizontal className="w-[18px] h-[18px]" />}
                  label="Narzędzia"
                  onClick={() => setMoreOpen((v) => !v)}
                  buttonProps={{ "aria-expanded": moreOpen }}
                  trailing={<ChevronDown className={cn("w-4 h-4 shrink-0 transition-transform duration-[var(--dur-fast)]", moreOpen && "rotate-180")} />}
                />
                {moreOpen && (
                  <div className="space-y-0.5 pl-2">
                    <SidebarRow icon={<History className="w-[18px] h-[18px]" />} label="Ostatnie akcje" onClick={onOpenActions} />
                    <SidebarRow icon={<Trophy className="w-[18px] h-[18px]" />} label="Statystyki" onClick={onOpenStats} />
                    <SidebarRow icon={<Brain className="w-[18px] h-[18px]" />} label="Tryb skupienia" onClick={onOpenFocusMode} />
                    <SidebarRow icon={<HelpCircle className="w-[18px] h-[18px]" />} label="Samouczek" onClick={() => window.dispatchEvent(new CustomEvent("kaczy:tour"))} />
                  </div>
                )}
                <InstallAppButton />
                <p className="text-2xs text-muted-foreground/40 text-center font-medium">NOTKI v1.0 • Zrobione przy piwie 🍺</p>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
