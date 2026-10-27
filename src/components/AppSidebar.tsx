import { useEffect, useMemo, useRef, useState } from "react";
import { folderProgress } from "@/lib/folderProgress";
import { m as motion, AnimatePresence } from "framer-motion";
import { useDroppable } from "@dnd-kit/core";
import {
  Settings as SettingsIcon, CircleQuestionMark, Tag, Moon, Sun, FolderOpen, Command, RotateCcwClock, Trophy, Brain, BrainCircuit, ExternalLink, Ellipsis, ChevronDown, Funnel, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sectionIconClass } from "@/lib/sections";
import { useNotesContext } from "@/hooks/NotesProvider";
import { buildLabelRows } from "@/lib/labelTree";
import { SidebarLabelItem } from "@/components/sidebar/SidebarLabelItem";
import { SidebarFolderItem } from "@/components/sidebar/SidebarFolderItem";
import { SidebarFilterItem } from "@/components/sidebar/SidebarFilterItem";
import { SidebarAddFolderButton } from "@/components/sidebar/SidebarAddFolderButton";
import { SidebarRow, SidebarCount } from "@/components/sidebar/SidebarRow";
import { InstallAppButton } from "@/components/InstallAppButton";
import { NMonogramLogo } from "@/components/NMonogramLogo";
import { AnimatedTagline } from "@/components/AnimatedTagline";
import { NotkiLogo } from "@/components/NotkiLogo";
import type { View } from "@/hooks/useFilteredNotes";
import { modShortcut } from "@/lib/platform";
import { useIsMobile } from "@/hooks/use-mobile";
import { dur, ease, tween } from "@/lib/motion";
import { useSavedFilters, sameQuery } from "@/lib/savedFilters";
import { searchNotes, useSearchReady } from "@/lib/searchNotes";
import { preloadView } from "@/lib/viewPreload";
import { groupSidebarItems, type SidebarGroupKey, type SidebarItem } from "@/components/sidebar/sidebarItems";
import { NEUROKLIK_URL } from "@/lib/neuroklik";

const MAX_FAVORITES = 10;

/** Zwinięte grupy paska (PW-4): zapamiętane per przeglądarka; błąd dostępu do pamięci = wszystkie otwarte. */
const SIDEBAR_GROUPS_KEY = "kaczy.sidebarGroups.v1";
function readCollapsedGroups(): Partial<Record<SidebarGroupKey, boolean>> {
  try {
    const parsed = JSON.parse(localStorage.getItem(SIDEBAR_GROUPS_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

// „Notatki” przyjmują upuszczoną notatkę (wyjęcie z folderu); pozostałe pozycje nie.
function NavRow({ item, active, onClick }: { item: SidebarItem; active: boolean; onClick: () => void }) {
  const droppableId = item.view === "notes" ? "notes-drop-root" : undefined;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId || `nav-${item.view}`, disabled: !droppableId });
  return (
    <div data-folder-drop-root={droppableId ? "" : undefined}>
      <SidebarRow
        ref={droppableId ? setNodeRef : undefined}
        icon={<item.icon className={cn("w-[18px] h-[18px]", sectionIconClass(item.view))} />}
        label={item.label}
        active={active}
        dropActive={isOver}
        onClick={onClick}
        // Paczka widoku (Kalendarz, Grafik, Nauka) zaczyna się pobierać przy najechaniu / dotknięciu, przed kliknięciem.
        buttonProps={{ onPointerEnter: () => preloadView(item.view), onPointerDown: () => preloadView(item.view) }}
        trailing={item.count !== undefined && item.count > 0 ? <SidebarCount value={item.count} active={active} alert={item.alert} /> : undefined}
      />
    </div>
  );
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
  /** Zapisany filtr: widok Notatki z tym zapytaniem. */
  onGoFilter: (query: string) => void;
  /** Ulubiona notatka z paska bocznego: otwiera ją w edytorze. */
  onOpenNote: (id: string) => void;
  /** Bieżące zapytanie wyszukiwarki — wyznacza aktywny filtr. */
  search: string;
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
  open, onClose, view, activeLabel, activeFolder, onGoView, onGoLabel, onGoFolder, onGoFilter, onOpenNote, search,
  sidebarItems, onLogoClick, dark, onToggleTheme, onOpenPalette, onOpenActions,
  onOpenStats, onOpenFocusMode, onSettingsOpenChange,
}: AppSidebarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(readCollapsedGroups);
  const toggleGroup = (key: SidebarGroupKey) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(next)); } catch { /* bez zapisu — zwinięcie działa do odświeżenia */ }
      return next;
    });
  };
  const isMobile = useIsMobile();
  const asideRef = useRef<HTMLElement>(null);
  // Telefon: pasek to okno modalne — fokus wchodzi do środka, Tab zapętla się w nim, Esc zamyka,
  // a po zamknięciu fokus wraca na przycisk, który go otworzył.
  useEffect(() => {
    const aside = asideRef.current;
    if (!open || !isMobile || !aside) return;
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(aside.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled])"));
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open, isMobile, onClose]);
  const { notes, allLabels, folders, renameLabel, removeLabel, addFolder, updateFolder, deleteFolder } = useNotesContext();
  const progressByFolder = useMemo(() => folderProgress(notes, folders), [notes, folders]);
  const { filters, rename: renameFilter, remove: removeFilter } = useSavedFilters();
  // Liczniki od startu — po wczytaniu silnika (wyszukiwanie rozmyte) liczone jeszcze raz.
  const searchReady = useSearchReady();
  const counts = useMemo(
    () => filters.map((f) => searchNotes(notes, f.query, { folders }).length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters, notes, folders, searchReady],
  );
  const favoriteTotal = useMemo(() => notes.filter((n) => n.favorite).length, [notes]);
  const favorites = useMemo(() => notes.filter((n) => n.favorite).slice(0, MAX_FAVORITES), [notes]);
  // Jedna pigułka aktywna naraz: gdy zapytanie jest zapisanym filtrem, „Notatki” gasną.
  const activeFilterId = view === "notes" ? filters.find((f) => sameQuery(search, f.query))?.id ?? null : null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: tween.enter }}
            exit={{ opacity: 0, transition: tween.exit }}
            className="fixed inset-0 z-overlay bg-foreground/30 desk:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>
      {/* initial={false}: przy starcie aplikacji pasek jest od razu rozwinięty — bez wjazdu od zera,
          który przesuwał całą treść (CLS) przy każdym wczytaniu strony. */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.aside
            ref={asideRef}
            role={isMobile ? "dialog" : undefined}
            aria-modal={isMobile ? true : undefined}
            aria-label={isMobile ? "Menu działów" : undefined}
            // Telefon: arkusz wjeżdża z krawędzi nad treścią. Desktop: pasek jest w układzie,
            // więc animujemy szerokość — treść odsuwa się razem z nim, zamiast skakać na końcu.
            initial={isMobile ? { x: "-100%" } : { width: 0 }}
            animate={isMobile ? { x: 0, transition: tween.enter } : { width: "17.5rem", transition: { duration: dur.slow, ease: ease.out } }}
            exit={isMobile ? { x: "-100%", transition: tween.exit } : { width: 0, transition: { duration: dur.base, ease: ease.in } }}
            className="shrink-0 max-w-[85vw] border-r border-border/50 sidebar-gradient overflow-hidden fixed left-0 top-0 bottom-0 z-modal shadow-2xl desk:relative desk:shadow-none"
          >
            <div className="p-5 space-y-1 w-70 max-w-[85vw] h-full flex flex-col scrollbar-thin overflow-y-auto">
              <div className="flex items-center gap-3 px-3 pb-6">
                <button
                  type="button"
                  onClick={onLogoClick}
                  className="pressable relative shrink-0 grid place-items-center w-12 h-12 rounded-card bg-linear-to-br from-primary/15 via-accent/10 to-transparent ring-1 ring-border/60"
                  aria-label="hydra"
                >
                  <div className="absolute inset-0 rounded-card bg-primary/20 blur-lg opacity-70 -z-raised" />
                  <NMonogramLogo />
                </button>
                <div>
                  <h1 className="leading-none"><NotkiLogo /></h1>
                  <AnimatedTagline text="Notuj, zanim zapomnisz" className="text-2xs text-muted-foreground font-medium mt-1.5" />
                </div>
              </div>

              {/* Kafle statystyk usunięte — liczniki są już przy pozycjach nawigacji. */}
              <div className="space-y-2">
                {groupSidebarItems(sidebarItems).map((g) => {
                  const collapsed = !!collapsedGroups[g.key];
                  const rows = (
                    <div className="space-y-0.5" hidden={collapsed}>
                      {g.items.map((item) => (
                        <NavRow
                          key={item.view}
                          item={item}
                          active={view === item.view && view !== "label" && !(item.view === "notes" && activeFilterId)}
                          onClick={() => onGoView(item.view)}
                        />
                      ))}
                    </div>
                  );
                  if (!g.label) return <div key={g.key}>{rows}</div>;
                  return (
                    <div key={g.key} data-sidebar-group={g.key}>
                      <button
                        type="button"
                        aria-expanded={!collapsed}
                        onClick={() => toggleGroup(g.key)}
                        className="section-caps px-3 mb-1 flex w-full items-center justify-between gap-1.5 py-1 rounded-control hover:text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {g.label}
                        <ChevronDown className={cn("w-3 h-3 transition-transform motion-reduce:transition-none", collapsed && "-rotate-90")} aria-hidden />
                      </button>
                      {rows}
                    </div>
                  );
                })}
              </div>

              {favorites.length > 0 && (
                <div className="pt-5">
                  <p className="section-caps px-3 mb-2 flex items-center gap-1.5">
                    <Star className="w-3 h-3" />
                    Ulubione
                  </p>
                  <div className="space-y-0.5" data-favorites>
                    {favorites.map((n) => (
                      <SidebarRow
                        key={n.id}
                        icon={n.icon ? <span className="text-sm leading-none">{n.icon}</span> : <Star className="w-[18px] h-[18px]" />}
                        label={n.locked ? "Notatka prywatna" : n.title.trim() || "Notatka bez tytułu"}
                        onClick={() => onOpenNote(n.id)}
                      />
                    ))}
                    {/* Lista pokazuje tylko MAX_FAVORITES — reszta nie znika po cichu (QoL). */}
                    {favoriteTotal > MAX_FAVORITES && (
                      <p className="px-3 pt-1 text-2xs text-muted-foreground" data-favorites-more>i {favoriteTotal - MAX_FAVORITES} więcej w Notatkach</p>
                    )}
                  </div>
                </div>
              )}

              {filters.length > 0 && (
                <div className="pt-5">
                  <p className="section-caps px-3 mb-2 flex items-center gap-1.5">
                    <Funnel className="w-3 h-3" />
                    Filtry
                  </p>
                  <div className="space-y-0.5" data-saved-filters>
                    {filters.map((f, i) => (
                      <SidebarFilterItem
                        key={f.id}
                        name={f.name}
                        query={f.query}
                        count={counts[i]}
                        isActive={activeFilterId === f.id}
                        onSelect={() => onGoFilter(f.query)}
                        onRename={(n) => renameFilter(f.id, n)}
                        onDelete={() => removeFilter(f.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {allLabels.length > 0 && (
                <div className="pt-5">
                  <p className="section-caps px-3 mb-2 flex items-center gap-1.5">
                    <Tag className="w-3 h-3" />
                    Etykiety
                  </p>
                  <div className="space-y-0.5">
                    {buildLabelRows(allLabels).map((row) => (
                      <SidebarLabelItem
                        key={row.label}
                        label={row.label}
                        displayName={row.name}
                        depth={row.depth}
                        isActive={view === "label" && activeLabel === row.label}
                        onSelect={() => onGoLabel(row.label)}
                        onRename={(newName) => renameLabel(row.label, newName)}
                        onDelete={() => removeLabel(row.label)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-5">
                <div className="flex items-center justify-between pl-3 pr-1 mb-1 min-h-7">
                  <p className="section-caps flex items-center gap-1.5">
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
                      progress={progressByFolder}
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

              <div className="pb-2 pt-4 border-t border-border/50 space-y-0.5">
                <SidebarRow
                  icon={<Command className="w-[18px] h-[18px]" />}
                  label="Paleta poleceń"
                  onClick={onOpenPalette}
                  trailing={<span className="shrink-0 text-2xs">{modShortcut("K")}</span>}
                />
                <SidebarRow
                  icon={dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
                  label="Tryb ciemny"
                  onClick={onToggleTheme}
                  buttonProps={{ "aria-label": "Tryb ciemny", "aria-pressed": dark }}
                />
                <SidebarRow icon={<SettingsIcon className="w-[18px] h-[18px]" />} label="Ustawienia" onClick={() => onSettingsOpenChange(true)} />
                <SidebarRow
                  icon={<BrainCircuit className="w-[18px] h-[18px]" />}
                  label="Trening mózgu"
                  onClick={() => window.open(NEUROKLIK_URL, "_blank", "noopener,noreferrer")}
                  trailing={<ExternalLink className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                  buttonProps={{ "aria-label": "Trening mózgu (otwiera się w nowej karcie)" }}
                />

                {/* Akcje drugorzędne zwinięte — sidebar ma się mieścić na 900 px. */}
                <SidebarRow
                  icon={<Ellipsis className="w-[18px] h-[18px]" />}
                  label="Narzędzia"
                  onClick={() => setMoreOpen((v) => !v)}
                  buttonProps={{ "aria-expanded": moreOpen }}
                  trailing={<ChevronDown className={cn("w-4 h-4 shrink-0 transition-transform duration-(--dur-fast)", moreOpen && "rotate-180")} />}
                />
                {moreOpen && (
                  <div className="space-y-0.5 pl-2">
                    <SidebarRow icon={<RotateCcwClock className="w-[18px] h-[18px]" />} label="Ostatnie akcje" onClick={onOpenActions} />
                    <SidebarRow icon={<Trophy className="w-[18px] h-[18px]" />} label="Statystyki" onClick={onOpenStats} />
                    <SidebarRow icon={<Brain className="w-[18px] h-[18px]" />} label="Tryb skupienia" onClick={onOpenFocusMode} />
                    <SidebarRow icon={<CircleQuestionMark className="w-[18px] h-[18px]" />} label="Samouczek" onClick={() => window.dispatchEvent(new CustomEvent("kaczy:tour"))} />
                  </div>
                )}
                <InstallAppButton />
                <p className="text-2xs text-muted-foreground text-center font-medium">hydra v1.0 • Notuj, zanim zapomnisz</p>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
