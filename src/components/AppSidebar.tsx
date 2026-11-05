import { useEffect, useMemo, useRef, useState } from "react";
import { folderProgress } from "@/lib/folderProgress";
import { m as motion, AnimatePresence } from "framer-motion";
import { useDroppable } from "@dnd-kit/core";
import {
  Settings as SettingsIcon, LayoutDashboard, CircleQuestionMark, Tag, Moon, Sun, FolderOpen, Command, RotateCcwClock, Trophy, Brain, BrainCircuit, ExternalLink, Ellipsis, ChevronDown, Funnel, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sectionIconClass } from "@/lib/sections";
import { shortcutFor } from "@/lib/shortcuts";
import { useNotesContext } from "@/hooks/NotesProvider";
import { buildLabelRows } from "@/lib/labelTree";
import { SidebarLabelItem } from "@/components/sidebar/SidebarLabelItem";
import { SidebarFolderItem } from "@/components/sidebar/SidebarFolderItem";
import { SidebarFilterItem } from "@/components/sidebar/SidebarFilterItem";
import { SidebarAddFolderButton } from "@/components/sidebar/SidebarAddFolderButton";
import { SidebarRow, SidebarCount } from "@/components/sidebar/SidebarRow";
import { useLongPress } from "@/hooks/useLongPress";
import { openQuickPresets } from "@/lib/quickPresets";
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
import { groupSidebarItems, type SidebarItem } from "@/components/sidebar/sidebarItems";
import { NEUROKLIK_URL } from "@/lib/neuroklik";
import { APP_VERSION } from "@/content/changelog";
import { AboutPanel } from "@/components/AboutPanel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { recentOpenedIds, useLastOpened } from "@/lib/lastOpened";
import { removeView, renameView, sameSource, saveView, useSavedViews, viewFromCurrent, viewSummary, type SavedView, type ViewSource } from "@/lib/savedViews";
import { getViewPrefs, useViewPrefs } from "@/lib/viewPrefs";
import { toast } from "sonner";
import { toastWithUndo } from "@/lib/undoToast";

const MAX_FAVORITES = 10;
/** 5.1: ostatnio otwierane notatki w pasku (grupa domyślnie zwinięta, żeby pasek nie rósł). */
const MAX_RECENT = 10;

/** Zwinięte grupy paska (PW-4): zapamiętane per przeglądarka. Bez zapisu „Osobiste” są zwinięte (plan wyglądu,
 *  Faza 7) — pasek ma się mieścić na 900 px; błąd dostępu do pamięci daje ten sam stan domyślny. */
const SIDEBAR_GROUPS_KEY = "kaczy.sidebarGroups.v1";
const DEFAULT_COLLAPSED_GROUPS: Partial<Record<string, boolean>> = { osobiste: true };
function readCollapsedGroups(): Partial<Record<string, boolean>> {
  try {
    const raw = localStorage.getItem(SIDEBAR_GROUPS_KEY);
    if (raw === null) return DEFAULT_COLLAPSED_GROUPS;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : DEFAULT_COLLAPSED_GROUPS;
  } catch {
    return DEFAULT_COLLAPSED_GROUPS;
  }
}

// „Notatki” przyjmują upuszczoną notatkę (wyjęcie z folderu); pozostałe pozycje nie.
function NavRow({ item, active, onClick }: { item: SidebarItem; active: boolean; onClick: () => void }) {
  const droppableId = item.view === "notes" ? "notes-drop-root" : undefined;
  // Działy z własnym odcieniem (plan 3.7): pigułka aktywnego wiersza w tym kolorze.
  const section = sectionIconClass(item.view);
  const { setNodeRef, isOver } = useDroppable({ id: droppableId || `nav-${item.view}`, disabled: !droppableId });
  return (
    <div data-folder-drop-root={droppableId ? "" : undefined}>
      <SidebarRow
        ref={droppableId ? setNodeRef : undefined}
        icon={<item.icon className={cn("w-[18px] h-[18px]", sectionIconClass(item.view))} />}
        label={item.label}
        active={active}
        dropActive={isOver}
        hue={section ? `var(--${section})` : undefined}
        onClick={onClick}
        // Paczka widoku (Kalendarz, Grafik, Nauka) zaczyna się pobierać przy najechaniu / dotknięciu, przed kliknięciem.
        buttonProps={{ onPointerEnter: () => preloadView(item.view), onPointerDown: () => preloadView(item.view), onFocus: () => preloadView(item.view) }}
        trailing={item.count !== undefined && item.count > 0 ? <SidebarCount value={item.count} active={active} alert={item.alert} /> : undefined}
      />
    </div>
  );
}

/** Nagłówek sekcji paska (plan 3.7): grupy, Etykiety i Foldery mają ten sam przepis — zwijany, z szewronem. */
function SidebarHeading({ label, icon, collapsed, onToggle, action }: {
  label: string; icon?: React.ReactNode; collapsed: boolean; onToggle: () => void; action?: React.ReactNode;
}) {
  return (
    <div className="mb-1 flex min-h-7 items-center justify-between gap-1 pr-1">
      <button
        type="button"
        aria-expanded={!collapsed}
        onClick={onToggle}
        className="section-caps flex min-w-0 flex-1 items-center justify-between gap-1.5 rounded-control px-3 py-1 hover:text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 items-center gap-1.5">{icon}{label}</span>
        <ChevronDown className={cn("w-3 h-3 shrink-0 transition-transform motion-reduce:transition-none", collapsed && "-rotate-90")} aria-hidden />
      </button>
      {action}
    </div>
  );
}

/** Ikona w stopce paska (plan 3.7): nazwa w `aria-label`, podpowiedź skrótu w `title`. */
function FooterIcon({ label, title, icon, onClick, extra }: {
  label: string; title: string; icon: React.ReactNode; onClick: () => void; extra?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title}
      {...extra}
      className="pressable grid size-10 place-items-center rounded-field text-muted-foreground hover:bg-muted/80 hover:text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:size-11"
    >
      {icon}
    </button>
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
  /** Zapisany widok (6.1): przejście do źródła z zapytaniem i ustawieniami widoku. */
  onOpenView: (v: SavedView) => void;
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
  open, onClose, view, activeLabel, activeFolder, onGoView, onGoLabel, onGoFolder, onGoFilter, onOpenView, onOpenNote, search,
  sidebarItems, onLogoClick, dark, onToggleTheme, onOpenPalette, onOpenActions,
  onOpenStats, onOpenFocusMode, onSettingsOpenChange,
}: AppSidebarProps) {
  // Przytrzymanie „Tryb ciemny” → szybkie zestawy wyglądu (plan motywów 1.3).
  const themePress = useLongPress(openQuickPresets);
  const [moreOpen, setMoreOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(readCollapsedGroups);
  const setGroupCollapsed = (key: string, collapsed: boolean) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [key]: collapsed };
      try { localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(next)); } catch { /* bez zapisu — zwinięcie działa do odświeżenia */ }
      return next;
    });
  };
  const isMobile = useIsMobile();
  const [aboutOpen, setAboutOpen] = useState(false);
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
  const lastOpened = useLastOpened();
  const recentCollapsed = collapsedGroups.ostatnie ?? true;
  const recentNotes = useMemo(() => {
    if (recentCollapsed) return [];
    const byId = new Map(notes.filter((n) => !n.locked && !n.trashed).map((n) => [n.id, n]));
    return recentOpenedIds(lastOpened, MAX_RECENT * 3).map((id) => byId.get(id)).filter((n) => n !== undefined).slice(0, MAX_RECENT);
  }, [recentCollapsed, lastOpened, notes]);
  const hasRecent = useMemo(() => Object.keys(lastOpened).length > 0, [lastOpened]);
  const savedViews = useSavedViews();
  const viewsCollapsed = !!collapsedGroups.widoki;
  // Widok da się zapisać tylko z list notatek (wszystkie, folder, etykieta).
  const viewSource: ViewSource | null = view === "notes" ? { kind: "all" } : view === "folder" && activeFolder ? { kind: "folder", id: activeFolder } : view === "label" && activeLabel ? { kind: "label", label: activeLabel } : null;
  const prefsNow = useViewPrefs();
  const activeViewId = viewSource ? savedViews.find((v) => sameSource(v.source, viewSource) && sameQuery(v.query, search) && v.layout === prefsNow.layout && v.sortKey === prefsNow.sortKey && v.groupBy === prefsNow.groupBy)?.id ?? null : null;
  // Jedna pigułka aktywna naraz: gdy zapytanie jest zapisanym filtrem, „Notatki” gasną.
  const activeFilterId = view === "notes" ? filters.find((f) => sameQuery(search, f.query))?.id ?? null : null;
  // Jak w grupach: otwarty wpis zawsze widać, zwinięcie go nie chowa.
  const labelsCollapsed = !!collapsedGroups.etykiety && view !== "label";
  const foldersCollapsed = !!collapsedGroups.foldery && view !== "folder";

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
            className="shrink-0 max-w-[85vw] border-r border-border/50 sidebar-gradient overflow-hidden fixed left-0 top-0 bottom-0 z-modal shadow-elevation-3 pl-[env(safe-area-inset-left)] desk:relative desk:shadow-none desk:pl-0"
          >
            <div className="p-5 space-y-1 w-70 max-w-[85vw] h-full flex flex-col scrollbar-thin overflow-y-auto">
              <div className="flex items-center gap-3 px-3 pb-6">
                <button
                  type="button"
                  onClick={onLogoClick}
                  className="pressable relative shrink-0 grid place-items-center w-12 h-12 rounded-card bg-linear-to-br from-primary/15 via-accent/10 to-transparent ring-1 ring-border/60"
                  aria-label="NOTKI"
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
                  // Grupa z otwartym działem zawsze widoczna — zwinięcie nie chowa miejsca, w którym jesteś.
                  const collapsed = !!collapsedGroups[g.key] && !g.items.some((item) => item.view === view);
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
                      <SidebarHeading label={g.label} collapsed={collapsed} onToggle={() => setGroupCollapsed(g.key, !collapsed)} />
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

              {hasRecent && (
                <div className="pt-5" data-sidebar-recent>
                  <SidebarHeading label="Ostatnie" icon={<RotateCcwClock className="w-3 h-3" />} collapsed={recentCollapsed}
                    onToggle={() => setGroupCollapsed("ostatnie", !recentCollapsed)} />
                  {!recentCollapsed && (
                    <div className="space-y-0.5">
                      {recentNotes.map((n) => (
                        <SidebarRow
                          key={n.id}
                          icon={n.icon ? <span className="text-sm leading-none">{n.icon}</span> : <RotateCcwClock className="w-[18px] h-[18px]" />}
                          label={n.title.trim() || "Notatka bez tytułu"}
                          onClick={() => onOpenNote(n.id)}
                        />
                      ))}
                      {recentNotes.length === 0 && <p className="px-3 pt-1 text-2xs text-muted-foreground">Otwarte notatki są w koszu albo zostały usunięte</p>}
                    </div>
                  )}
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

              {/* Zapisane widoki (nowy plan 6.1): źródło, zapytanie, układ, sortowanie i filtry pod nazwą; w Yjs. */}
              <div className="pt-5" data-saved-views>
                <SidebarHeading label="Widoki" icon={<LayoutDashboard className="w-3 h-3" />} collapsed={viewsCollapsed}
                  onToggle={() => setGroupCollapsed("widoki", !viewsCollapsed)}
                  action={<SidebarAddFolderButton kind="view" disabled={!viewSource} onAdd={(name) => {
                    if (!viewSource) return;
                    const v = viewFromCurrent(crypto.randomUUID(), name, viewSource, search, getViewPrefs(), Date.now());
                    if (!v || !saveView(v)) { toast.error("Nie udało się zapisać widoku — jest już najwięcej widoków"); return; }
                    if (viewsCollapsed) setGroupCollapsed("widoki", false);
                    toast.success(`Zapisano widok „${v.name}”`);
                  }} />} />
                {!viewsCollapsed && (
                  <div className="space-y-0.5">
                    {savedViews.map((v) => (
                      <SidebarFilterItem
                        key={v.id}
                        kind="view"
                        name={v.name}
                        query={viewSummary(v, (id) => folders.find((f) => f.id === id)?.name)}
                        isActive={activeViewId === v.id}
                        onSelect={() => onOpenView(v)}
                        onRename={(n) => renameView(v.id, n)}
                        onDelete={() => {
                          const removed = removeView(v.id);
                          if (removed) toastWithUndo(`Usunięto widok „${removed.name}”`, () => saveView(removed));
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {allLabels.length > 0 && (
                <div className="pt-5">
                  <SidebarHeading label="Etykiety" icon={<Tag className="w-3 h-3" />} collapsed={labelsCollapsed}
                    onToggle={() => setGroupCollapsed("etykiety", !labelsCollapsed)} />
                  <div className="space-y-0.5" hidden={labelsCollapsed}>
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
                <SidebarHeading label="Foldery" icon={<FolderOpen className="w-3 h-3" />} collapsed={foldersCollapsed}
                  onToggle={() => setGroupCollapsed("foldery", !foldersCollapsed)}
                  action={<SidebarAddFolderButton onAdd={(name) => addFolder(name)} />} />
                <div className="space-y-0.5" hidden={foldersCollapsed}>
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

              <div className="pb-2 pt-4 border-t border-border/50 space-y-1">
                {/* Stopka (plan 3.7): jeden rząd ikon zamiast trzech wierszy; slogan jest już pod logo. */}
                <div className="flex items-center justify-between gap-1" role="group" aria-label="Szybkie akcje">
                  <FooterIcon label="Paleta poleceń" title={`Paleta poleceń (${modShortcut("K")})`} onClick={onOpenPalette}
                    icon={<Command className="w-[18px] h-[18px]" />} />
                  <FooterIcon label="Tryb ciemny" title="Przytrzymaj albo prawy przycisk: zestawy wyglądu" onClick={() => { if (!themePress.shouldSkipClick()) onToggleTheme(); }}
                    extra={{ "aria-pressed": dark, ...themePress.handlers }}
                    icon={dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />} />
                  <FooterIcon label="Ustawienia" title={`Ustawienia (${shortcutFor("Ustawienia")})`} onClick={() => onSettingsOpenChange(true)}
                    icon={<SettingsIcon className="w-[18px] h-[18px]" />} />
                </div>

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
                    <SidebarRow icon={<Trophy className="w-[18px] h-[18px]" />} label="Statystyki" tipKeys={shortcutFor("Statystyki")} onClick={onOpenStats} />
                    <SidebarRow icon={<Brain className="w-[18px] h-[18px]" />} label="Tryb skupienia" onClick={onOpenFocusMode} />
                    <SidebarRow icon={<CircleQuestionMark className="w-[18px] h-[18px]" />} label="Samouczek" onClick={() => window.dispatchEvent(new CustomEvent("kaczy:tour"))} />
                    <SidebarRow
                      icon={<BrainCircuit className="w-[18px] h-[18px]" />}
                      label="Trening mózgu"
                      onClick={() => window.open(NEUROKLIK_URL, "_blank", "noopener,noreferrer")}
                      trailing={<ExternalLink className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                      buttonProps={{ "aria-label": "Trening mózgu (otwiera się w nowej karcie)" }}
                    />
                    <InstallAppButton />
                  </div>
                )}
                {/* 5.7: wersja, build i stan pracy offline w oknie; tu tylko wejście. */}
                <button type="button" onClick={() => { if (isMobile) onClose(); setAboutOpen(true); }}
                  className="mx-3 mt-1 rounded-control text-left text-2xs text-muted-foreground hover:text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11">
                  O aplikacji · wersja {APP_VERSION}
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      {/* Poza paskiem: na telefonie pasek jest oknem z własną pułapką fokusu, więc zamykamy go przed otwarciem. */}
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>O aplikacji</DialogTitle>
            <DialogDescription>NOTKI — notatki, grafik i praca w jednym miejscu, także bez internetu.</DialogDescription>
          </DialogHeader>
          <AboutPanel />
        </DialogContent>
      </Dialog>
    </>
  );
}
