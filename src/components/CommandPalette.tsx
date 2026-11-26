import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { FINISH_SHIFT_NOW_EVENT } from "@/lib/shiftCommands";
import { Ruler, Inbox, StickyNote, Star, Archive, Bell, Trash, Plus, Settings, Calendar, CalendarRange, BriefcaseBusiness, HardHat, HandCoins, Dumbbell, RotateCcwClock, Bookmark, Copy, Heading, Hash, Pin, Clock, Camera, PackageSearch, FileText, Link2, FolderInput, Download, ArrowLeft, Folder as FolderIcon, UserRound } from "lucide-react";
import type { Note } from "@/hooks/useNotes";
import { searchNotes, useSearchVersion } from "@/lib/searchNotes";
import { copyNoteAddress, copyWikiLink } from "@/lib/noteMarkdown";
import { folderCrumbs } from "@/lib/breadcrumbs";
import { sectionHits } from "@/lib/sectionHits";
import { requestHeading } from "@/lib/wikiHeading";
import type { PeriodKind } from "@/lib/periodNote";
import { loadRecentSearches, saveRecentSearch } from "@/lib/recentSearches";
import { loadRecentCommands, saveRecentCommand } from "@/lib/recentCommands";
import { requestShiftDay, searchShiftDays, useShifts } from "@/lib/shifts";
import { useNotesContext } from "@/hooks/NotesProvider";
import { useSavedFilters } from "@/lib/savedFilters";
import { useVault } from "@/hooks/usePrivateNotes";
import { useSiteDirectory, useStudy, useStudyLists } from "@/lib/study/store";
import { searchQuestions, STUDY_TOPIC_PARAM } from "@/lib/study/questionSearch";
import { topicTitle } from "@/lib/study/content";
import { siteCardUrl } from "@/lib/study/siteLink";
import { clientUrl } from "@/lib/study/tab";
import { searchClients } from "@/lib/clients/model";
import { useClients } from "@/lib/clients/store";
import { useWorkSearch, type WorkHit } from "@/lib/study/workSearch";
import { entrySiteId, foldName } from "@/lib/study/siteKey";
import { isViewShown, useHiddenViews } from "@/lib/hiddenViews";
import { viewLabel } from "@/lib/viewMeta";
import { useSkin } from "@/lib/skins";
import { recentOpenedIds, useLastOpened } from "@/lib/lastOpened";
import { formatReminderShort } from "@/lib/reminderTime";
import { searchSettings } from "@/lib/settingsIndex";
import { requestSettingsSection } from "@/lib/settingsDeepLink";
import { isNativeShell } from "@/lib/native/platform";
import { cn } from "@/lib/utils";
import { useAppFont } from "@/lib/appFont";
import { shortcutFor } from "@/lib/shortcuts";
import { setThemeMode } from "@/hooks/useTheme";
import { commandGroups, resolveLabel, resolveShortcut, type CommandContext, type GoView } from "@/lib/commands/registry";
import { registerBuiltinCommands } from "@/lib/commands/builtin";

registerBuiltinCommands();

const NOTE_LIMIT = 30;
/** 5.1: tyle ostatnio otwieranych notatek pokazuje pusta paleta. */
const RECENT_NOTES = 10;

export interface CommandAction {
  id: string;
  label: string;
  hint?: string;
  icon: React.ElementType;
  run: () => void;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: Note[];
  onOpenNote: (id: string) => void;
  onNewNote: (title?: string) => void;
  onDailyNote: () => void;
  onPeriodNote: (kind: PeriodKind) => void;
  onGo: (view: GoView) => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenStats: () => void;
  /** Skrzynka 2.3: okno „Do skrzynki” bez zmiany widoku. */
  onQuickInbox: () => void;
  onOpenFocusMode: () => void;
  onOpenShortcuts: () => void;
  onGoFilter: (query: string) => void;
  /** Jest tylko, gdy jest „bieżąca” notatka (otwarta w czytniku, zaznaczona lub z fokusem). */
  onCopyNote?: (format: "markdown" | "text") => void;
  /** Bieżąca notatka (czytnik, zaznaczenie lub fokus): jej akcje idą na górę palety (plan 3.9). */
  currentNote?: Note | null;
  onTogglePin?: (id: string) => void;
  /** Plan-nowy 2.8 (QoL 3.9): reszta akcji bieżącej notatki — te same funkcje co na kaflu (z „Cofnij”). */
  onArchive?: (id: string) => void;
  onTrash?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onToggleFavorite?: (id: string, favorite: boolean) => void;
  /** Plan Notatek 2.5: przeniesienie bieżącej notatki do folderu (`null` = bez folderu). */
  onMoveToFolder?: (id: string, folderId: string | null) => void;
  /** Widok z adresu: w Grafiku paleta pokazuje akcje zmiany. */
  view?: string;
}

type NavItem = { id: Parameters<Props["onGo"]>[0]; label: string; Icon: typeof StickyNote; hint?: string };
const NAV_ITEMS: NavItem[] = [
  { id: "notes", label: viewLabel("notes"), Icon: StickyNote },
  { id: "inbox", label: viewLabel("inbox"), Icon: Inbox },
  { id: "today", label: viewLabel("today"), Icon: Calendar, hint: shortcutFor("Przejdź do „Dziś”") },
  { id: "reminders", label: viewLabel("reminders"), Icon: Bell },
  { id: "calendar", label: viewLabel("calendar"), Icon: CalendarRange },
  { id: "shifts", label: viewLabel("shifts"), Icon: BriefcaseBusiness },
  { id: "study", label: viewLabel("study"), Icon: HardHat },
  { id: "debts", label: viewLabel("debts"), Icon: HandCoins },
  { id: "cwiczenia", label: viewLabel("cwiczenia"), Icon: Dumbbell },
  { id: "plans", label: viewLabel("plans"), Icon: Ruler },
  { id: "archive", label: viewLabel("archive"), Icon: Archive },
  { id: "trash", label: viewLabel("trash"), Icon: Trash },
];

async function exportCurrent(note: Note, kind: "html" | "pdf" | "md") {
  if (kind === "html") (await import("@/lib/backup/download")).exportToHTML([note]);
  else if (kind === "pdf") (await import("@/lib/exportPdf")).exportToPDF([note]);
  else (await import("@/lib/backup/download")).exportToMarkdown([note]);
}

export function CommandPalette({
  open,
  onOpenChange,
  notes,
  onOpenNote,
  onNewNote,
  onDailyNote,
  onPeriodNote,
  onGo,
  onToggleTheme,
  onOpenSettings,
  onOpenStats,
  onQuickInbox,
  onOpenFocusMode,
  onOpenShortcuts,
  onGoFilter,
  onCopyNote,
  currentNote,
  onTogglePin,
  onArchive,
  onTrash,
  onDuplicate,
  onToggleFavorite,
  onMoveToFolder,
  view,
}: Props) {
  const { folders } = useNotesContext();
  const { filters } = useSavedFilters();
  const [search, setSearch] = useState("");
  // Plan Notatek 2.5: drugi „ekran” palety — wybór folderu dla bieżącej notatki.
  const [pickFolder, setPickFolder] = useState(false);
  // Ostatnie zapytania, które zakończyły się otwarciem notatki (max 5, localStorage).
  const [recent, setRecent] = useState<string[]>(loadRecentSearches);
  // Notatki prywatne nie pojawiają się w palecie (ani tytułem, ani treścią) — także po odblokowaniu.
  const publicNotes = useMemo(() => notes.filter((n) => !n.locked), [notes]);
  const searchVersion = useSearchVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `searchVersion`: przeliczenie po wczytaniu silnika i odpowiedzi Workera
  const matched = useMemo(() => searchNotes(publicNotes, search, { folders }), [publicNotes, search, folders, searchVersion]);
  // Nagłówki i bloki pasujące do tekstu (bez operatorów): skok prosto do sekcji.
  const sections = useMemo(() => sectionHits(publicNotes, search, { folders }), [publicNotes, search, folders]);
  // 5.3: wyniki według rodzaju — notatki z terminem idą do grupy „Terminy” (z datą), reszta do „Notatki”.
  const dueHits = useMemo(() => matched.filter((n) => n.reminder !== null && !n.trashed), [matched]);
  const noteHits = useMemo(() => matched.filter((n) => n.reminder === null || n.trashed), [matched]);
  const settingsHits = useMemo(() => searchSettings(search), [search]);
  // 5.1: ostatnio otwierane (lokalnie, `lastOpened.ts`), tylko notatki, które nadal są i nie są w koszu.
  const lastOpened = useLastOpened();
  const recentNotes = useMemo(() => {
    if (!open) return [];
    const byId = new Map(publicNotes.filter((n) => !n.trashed).map((n) => [n.id, n]));
    return recentOpenedIds(lastOpened, RECENT_NOTES * 3).map((id) => byId.get(id)).filter((n): n is Note => n !== undefined).slice(0, RECENT_NOTES);
  }, [open, lastOpened, publicNotes]);
  const vault = useVault();
  const navigate = useNavigate();
  // Praca w palecie (2.5): budowy i wpisy pasujące do tekstu, plus „Nowy wpis” i „Raport dnia”.
  const studyState = useStudy();
  const siteDir = useSiteDirectory();
  const studyHits = useMemo(() => {
    const q = foldName(search);
    if (!q) return { sites: [], entries: [] };
    const sites = siteDir.filter((x) => x.archived === undefined && foldName(x.name).includes(q)).slice(0, 6);
    const entries = [...studyState.journal].reverse().filter((e) => foldName(`${e.text} ${e.site}`).includes(q)).slice(0, 6);
    return { sites, entries };
  }, [search, siteDir, studyState.journal]);
  // Klienci (plan wycen i klientów, 2.5): aktywni, po nazwie, telefonie, NIP-ie i adresie; wynik otwiera kartę klienta.
  const clients = useClients();
  const clientHits = useMemo(() => (search.trim() ? searchClients(clients.filter((c) => !c.archived), search).slice(0, 6) : []), [clients, search]);
  // B2.5: wpisy, braki i dokumenty z kart budów — MiniSearch (literówki, bez ogonków, „zawór Lipowa”).
  // Do czasu załadowania biblioteki działa dokładne dopasowanie z `studyHits.entries`.
  const workHits = useWorkSearch(search, siteDir, studyState.journal);
  const workEntries = workHits.filter((h) => h.kind === "entry");
  const workOther = workHits.filter((h) => h.kind !== "entry");
  // P4.2: pytania quizu bez polskich znaków — wynik otwiera quiz z tematu pytania.
  const studyLists = useStudyLists();
  const questionHits = useMemo(() => searchQuestions(studyLists.questions, search, 5), [studyLists.questions, search]);
  const shifts = useShifts();
  const shiftHits = useMemo(() => {
    const types = new Map(shifts.types.map((x) => [x.id, x]));
    return searchShiftDays(search, shifts.days, types);
  }, [shifts, search]);
  const hasForcedHits = matched.length > 0 || sections.length > 0 || settingsHits.length > 0 || shiftHits.length > 0;

  // Nawigacja jako dane: ta sama lista rysuje grupę i „Ostatnio użyte”.
  const hiddenViews = useHiddenViews();
  const navKnown = NAV_ITEMS.map((n) => n.id);
  const [recentCmds, setRecentCmds] = useState<string[]>(() => loadRecentCommands(navKnown));
  const recentNav = recentCmds.map((id) => NAV_ITEMS.find((n) => n.id === id)).filter((n): n is NavItem => n !== undefined && isViewShown(hiddenViews, n.id));
  function goNav(id: NavItem["id"]) {
    setRecentCmds(saveRecentCommand(navKnown, id));
    onGo(id);
  }

  // Styl i krój do kontekstu poleceń: „Następny styl” w Akcjach, listy stylów i krojów z rejestru po wpisaniu tekstu.
  const skin = useSkin();
  const font = useAppFont();

  const cmdCtx: CommandContext = {
    navigate, go: onGo, newNote: () => onNewNote(), quickInbox: onQuickInbox, dailyNote: onDailyNote, periodNote: onPeriodNote,
    openSettings: onOpenSettings, openStats: onOpenStats, openFocusMode: onOpenFocusMode, openShortcuts: onOpenShortcuts,
    toggleTheme: onToggleTheme, setThemeMode, copyNote: onCopyNote, vaultPhase: vault.phase, skin, view, hasQuery: !!search.trim(), font,
  };

  function run(fn: () => void) {
    onOpenChange(false);
    setTimeout(fn, 0);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Szukaj notatek, terminów, Pracy, ustawień i akcji…" value={search} onValueChange={setSearch} />
      <CommandList>
        {/* Grupy z `forceMount` (notatki, terminy, ustawienia, grafik, sekcje) cmdk nie liczy — bez tego „Brak wyników”
            stało nad trafieniem w Ustawieniach (Etap 7). */}
        {!hasForcedHits && <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-2">
            <span>Brak wyników.</span>
            {search.trim() && (
              <button
                type="button"
                onClick={() => run(() => onNewNote(search.trim()))}
                className="flex items-center gap-1.5 text-xs text-primary-ink hover:underline"
              >
                <Plus className="size-3.5" /> Utwórz notatkę „{search.trim()}”
              </button>
            )}
          </div>
        </CommandEmpty>}
        {currentNote && pickFolder && onMoveToFolder && (
          <CommandGroup heading="Przenieś do folderu">
            <CommandItem value="wróć" onSelect={() => setPickFolder(false)}>
              <ArrowLeft className="size-4 mr-2" /> Wróć
            </CommandItem>
            {currentNote.folderId && (
              <CommandItem value="bez folderu" onSelect={() => run(() => onMoveToFolder(currentNote.id, null))}>
                <StickyNote className="size-4 mr-2" /> Bez folderu
              </CommandItem>
            )}
            {folders.filter((f) => f.id !== currentNote.folderId).map((f) => {
              const path = [...folderCrumbs(folders, f.id).map((c) => c.label), f.name || "Folder"].join(" / ");
              return (
                <CommandItem key={f.id} value={`folder ${path}`} onSelect={() => run(() => onMoveToFolder(currentNote.id, f.id))}>
                  <FolderIcon className="size-4 mr-2" /> {f.emoji ? `${f.emoji} ` : ""}{path}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
        {currentNote && !search.trim() && !pickFolder && (
          <>
            <CommandGroup heading="Ta notatka">
              <CommandItem value="ta notatka otwórz" onSelect={() => run(() => onOpenNote(currentNote.id))}>
                <StickyNote className="size-4 mr-2" /> Otwórz
              </CommandItem>
              {onTogglePin && !currentNote.trashed && (
                <CommandItem value={currentNote.pinned ? "ta notatka odepnij" : "ta notatka przypnij"} onSelect={() => run(() => onTogglePin(currentNote.id))}>
                  <Pin className="size-4 mr-2" /> {currentNote.pinned ? "Odepnij" : "Przypnij"}
                </CommandItem>
              )}
              {onToggleFavorite && !currentNote.trashed && (
                <CommandItem value={currentNote.favorite ? "ta notatka usun z ulubionych" : "ta notatka do ulubionych"} onSelect={() => run(() => onToggleFavorite(currentNote.id, !currentNote.favorite))}>
                  <Star className="size-4 mr-2" /> {currentNote.favorite ? "Usuń z ulubionych" : "Do ulubionych"}
                </CommandItem>
              )}
              {currentNote.title.trim() && !currentNote.locked && (
                <CommandItem value="ta notatka kopiuj link wiki" onSelect={() => run(() => { void copyWikiLink(currentNote); })}>
                  <Link2 className="size-4 mr-2" /> Kopiuj link [[{currentNote.title.trim()}]]
                </CommandItem>
              )}
              {/* W APK adres to `https://localhost/…` — poza aplikacją nic nie otworzy, więc polecenia nie ma. */}
              {!currentNote.trashed && !isNativeShell() && (
                <CommandItem value="ta notatka kopiuj adres url nfc skrot" onSelect={() => run(() => { void copyNoteAddress(currentNote.id); })}>
                  <Link2 className="size-4 mr-2" /> Kopiuj adres notatki
                </CommandItem>
              )}
              {onMoveToFolder && !currentNote.trashed && folders.length > 0 && (
                <CommandItem value="ta notatka przenies do folderu" onSelect={() => { setSearch(""); setPickFolder(true); }}>
                  <FolderInput className="size-4 mr-2" /> Przenieś do folderu…
                </CommandItem>
              )}
              {!currentNote.locked && (["html", "pdf", "md"] as const).map((kind) => (
                <CommandItem key={kind} value={`ta notatka eksport ${kind}`} onSelect={() => run(() => { void exportCurrent(currentNote, kind); })}>
                  <Download className="size-4 mr-2" /> Eksportuj jako {kind === "md" ? "Markdown" : kind.toUpperCase()}
                </CommandItem>
              ))}
              {onDuplicate && !currentNote.trashed && (
                <CommandItem value="ta notatka duplikuj" onSelect={() => run(() => onDuplicate(currentNote.id))}>
                  <Copy className="size-4 mr-2" /> Duplikuj
                </CommandItem>
              )}
              {onArchive && !currentNote.trashed && !currentNote.archived && (
                <CommandItem value="ta notatka archiwizuj" onSelect={() => run(() => onArchive(currentNote.id))}>
                  <Archive className="size-4 mr-2" /> Archiwizuj
                </CommandItem>
              )}
              {onTrash && !currentNote.trashed && (
                <CommandItem value="ta notatka do kosza usun" onSelect={() => run(() => onTrash(currentNote.id))}>
                  <Trash className="size-4 mr-2" /> Do kosza
                </CommandItem>
              )}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {recentNotes.length > 0 && !search.trim() && (
          <>
            <CommandGroup heading="Ostatnie notatki">
              {recentNotes.map((n) => (
                <CommandItem key={`last-${n.id}`} value={`ostatnie ${n.id}`} onSelect={() => run(() => onOpenNote(n.id))}>
                  <RotateCcwClock className="size-4 mr-2 text-muted-foreground" />
                  <span className="truncate">{n.title || n.content.slice(0, 60) || "(bez tytułu)"}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {view === "shifts" && !search.trim() && (
          <>
            <CommandGroup heading="Grafik">
              <CommandItem value="grafik skończyłem teraz koniec zmiany" onSelect={() => run(() => window.dispatchEvent(new Event(FINISH_SHIFT_NOW_EVENT)))}>
                <Clock className="size-4 mr-2" /> Skończyłem teraz
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {recentNav.length > 0 && !search.trim() && (
          <>
            <CommandGroup heading="Ostatnio użyte">
              {recentNav.map((n) => (
                <CommandItem key={`recent-${n.id}`} value={`ostatnio ${n.label}`} onSelect={() => run(() => goNav(n.id))}>
                  <n.Icon className="size-4 mr-2" /> {n.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {recent.length > 0 && !search.trim() && (
          <>
            <CommandGroup heading="Ostatnio szukane">
              {recent.map((q) => (
                <CommandItem key={q} value={`recent-${q}`} onSelect={() => setSearch(q)}>
                  <RotateCcwClock className="size-4 mr-2 text-muted-foreground" />
                  <span className="truncate">{q}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {filters.length > 0 && (
          <>
            <CommandGroup heading="Filtry">
              {filters.map((f) => (
                <CommandItem key={f.id} value={`filtr ${f.name}`} onSelect={() => run(() => onGoFilter(f.query))}>
                  <Bookmark className="size-4 mr-2" />
                  <span className="truncate">{f.name}</span>
                  <span className="ml-auto pl-3 text-xs text-muted-foreground truncate max-w-[40%]">{f.query}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {questionHits.length > 0 && (
          <CommandGroup heading="Pytania z Nauki">
            {questionHits.map((q) => (
              // `value` z bieżącym zapytaniem: filtr cmdk nie zna polskich znaków, a trafienie już jest policzone.
              <CommandItem key={`question-${q.id}`} value={`pytanie ${q.id} ${search}`} onSelect={() => run(() => navigate(`/praca?${STUDY_TOPIC_PARAM}=${encodeURIComponent(q.topic)}`))}>
                <HardHat className="size-4 mr-2 text-muted-foreground" />
                <span className="truncate">{q.question}</span>
                <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground">{topicTitle(q.topic)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {clientHits.length > 0 && (
          <CommandGroup heading="Klienci">
            {clientHits.map((c) => (
              <CommandItem key={`client-${c.id}`} value={`klient ${c.name} ${c.phone} ${c.nip} ${c.address1}`} onSelect={() => run(() => navigate(clientUrl(c.id)))}>
                <UserRound className="size-4 mr-2 text-muted-foreground" />
                <span className="truncate">Klient: {c.name}</span>
                {c.phone && <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground">{c.phone}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {(studyHits.sites.length > 0 || studyHits.entries.length > 0 || workHits.length > 0) && (
          <>
            {studyHits.sites.length > 0 && (
              <CommandGroup heading="Budowy">
                {studyHits.sites.map((x) => (
                  <CommandItem key={`site-${x.id}`} value={`budowa ${x.name}`} onSelect={() => run(() => navigate(siteCardUrl(x.id)))}>
                    <HardHat className="size-4 mr-2 text-muted-foreground" />
                    <span className="truncate">Karta budowy: {x.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {workEntries.length > 0 ? (
              <CommandGroup heading="Wpisy w Pracy">
                {workEntries.map((h) => <WorkHitItem key={h.key} hit={h} search={search} run={run} />)}
              </CommandGroup>
            ) : studyHits.entries.length > 0 && (
              <CommandGroup heading="Wpisy w Pracy">
                {studyHits.entries.map((e) => {
                  const id = entrySiteId(e);
                  return (
                    <CommandItem key={`entry-${e.id}`} value={`wpis ${e.text} ${e.site}`} onSelect={() => run(() => navigate(id ? siteCardUrl(id) : "/praca"))}>
                      <HardHat className="size-4 mr-2 text-muted-foreground" />
                      <span className="truncate">{e.text.slice(0, 60) || "bez opisu"}</span>
                      {e.site && <span className="ml-auto text-xs text-muted-foreground">{e.site}</span>}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {workOther.length > 0 && (
              <CommandGroup heading="Braki i dokumenty">
                {workOther.map((h) => <WorkHitItem key={h.key} hit={h} search={search} run={run} />)}
              </CommandGroup>
            )}
            <CommandSeparator />
          </>
        )}
        {/* A3.4: grupy Kalendarz, Praca, Grafik i Akcje z rejestru poleceń (`src/lib/commands/`). */}
        {commandGroups(cmdCtx).map((g) => (
          <CommandGroup key={g.heading} heading={g.heading}>
            {g.commands.map((c) => {
              const label = resolveLabel(c, cmdCtx);
              const right = c.hint?.(cmdCtx) ?? resolveShortcut(c);
              return (
                <CommandItem key={c.id} value={`${label} ${c.keywords ?? ""}`} data-command-id={c.id} onSelect={() => run(() => c.run(cmdCtx))}>
                  {c.icon && <c.icon className={cn("size-4 mr-2", g.mutedIcons && "text-muted-foreground")} />} {label}
                  {right && <span className="ml-auto pl-3 truncate text-xs text-muted-foreground">{right}</span>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Nawigacja">
          {NAV_ITEMS.filter((n) => isViewShown(hiddenViews, n.id)).map((n) => (
            <CommandItem key={n.id} value={`nawigacja ${n.label}`} onSelect={() => run(() => goNav(n.id))}>
              <n.Icon className="size-4 mr-2" /> {n.label}
              {n.hint && <span className="ml-auto text-xs text-muted-foreground">{n.hint}</span>}
            </CommandItem>
          ))}
        </CommandGroup>
        {shiftHits.length > 0 && (
          <>
            <CommandSeparator />
            {/* Dni grafiku filtruje `searchShiftDays`, nie cmdk — stąd `forceMount`. */}
            <CommandGroup heading="Grafik" forceMount>
              {shiftHits.map((h) => (
                <CommandItem
                  key={h.key}
                  forceMount
                  value={`shift-${h.key}`}
                  onSelect={() => run(() => { requestShiftDay(h.key); onGo("shifts"); })}
                >
                  <BriefcaseBusiness className="size-4 mr-2 text-muted-foreground" />
                  <span className="truncate first-letter:uppercase">{h.dateLabel}</span>
                  <span className="ml-2 truncate text-xs text-muted-foreground">{h.shiftLabel}{h.note ? ` · ${h.note}` : ""}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {sections.length > 0 && (
          <>
            <CommandSeparator />
            {/* Jak grupa Grafik: `sectionHits` filtruje sam, więc `forceMount`. */}
            <CommandGroup heading="Nagłówki i bloki" forceMount>
              {sections.map((h, i) => (
                <CommandItem
                  key={`${h.note.id}-${h.target}-${i}`}
                  forceMount
                  value={`sekcja-${h.note.id}-${i}`}
                  onSelect={() => { setRecent(saveRecentSearch(search)); run(() => { requestHeading(h.target); onOpenNote(h.note.id); }); }}
                >
                  {h.kind === "heading" ? <Heading className="size-4 mr-2 text-muted-foreground" /> : <Hash className="size-4 mr-2 text-muted-foreground" />}
                  <span className="truncate">{h.text}</span>
                  <span className="ml-2 truncate text-xs text-muted-foreground">{h.note.title || "(bez tytułu)"}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {dueHits.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Terminy" forceMount>
              {dueHits.slice(0, 8).map((n) => (
                <CommandItem key={`due-${n.id}`} forceMount value={`termin-${n.id}`} onSelect={() => { setRecent(saveRecentSearch(search)); run(() => onOpenNote(n.id)); }}>
                  <Bell className="size-4 mr-2 text-muted-foreground" />
                  <span className="truncate">{n.title || n.content.slice(0, 60) || "(bez tytułu)"}</span>
                  <span className="ml-auto shrink-0 pl-2 font-mono text-xs tabular-nums text-muted-foreground">{formatReminderShort(n.reminder!)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {settingsHits.length > 0 && (
          <>
            <CommandSeparator />
            {/* Jak Grafik: `searchSettings` filtruje sam (bez polskich znaków). */}
            <CommandGroup heading="Ustawienia" forceMount>
              {settingsHits.map((e) => (
                <CommandItem key={`set-${e.title}`} forceMount value={`ustawienie-${e.title}`} onSelect={() => run(() => { requestSettingsSection(e.tab, e.title, e.expand); onOpenSettings(); })}>
                  <Settings className="size-4 mr-2 text-muted-foreground" />
                  <span className="truncate">{e.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {noteHits.length > 0 && (
          <>
            <CommandSeparator />
            {/* Filtruje `searchNotes` (ten sam silnik co pasek wyszukiwania, z
                checklistami i operatorami), a dopiero potem tniemy — inaczej
                paleta widziałaby tylko 30 najnowszych notatek. `forceMount`, bo
                wynik wyszukiwania nie musi przejść wewnętrznego filtra cmdk. */}
            <CommandGroup
              heading={noteHits.length > NOTE_LIMIT ? `Notatki — pokazano ${NOTE_LIMIT} z ${noteHits.length}` : "Notatki"}
              forceMount
            >
              {noteHits.slice(0, NOTE_LIMIT).map((n) => (
                <CommandItem key={n.id} forceMount value={`note-${n.id}`} onSelect={() => { setRecent(saveRecentSearch(search)); run(() => onOpenNote(n.id)); }}>
                  <StickyNote className="size-4 mr-2 text-muted-foreground" />
                  <span className="truncate">{n.title || n.content.slice(0, 60) || "(bez tytułu)"}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/** Trafienie wyszukiwania w Pracy (B2.5): wpis, brak albo dokument — otwiera kartę budowy. */
function WorkHitItem({ hit, search, run }: { hit: WorkHit; search: string; run: (fn: () => void) => void }) {
  const navigate = useNavigate();
  const Icon = hit.kind === "shortage" ? PackageSearch : hit.kind === "doc" ? FileText : HardHat;
  return (
    // `value` z bieżącym zapytaniem: trafienie policzył MiniSearch, filtr cmdk go nie rusza.
    <CommandItem value={`${hit.key} ${search}`} onSelect={() => run(() => navigate(hit.siteId ? siteCardUrl(hit.siteId) : "/praca"))}>
      <Icon className="size-4 mr-2 text-muted-foreground" aria-hidden />
      <span className="truncate">{hit.title}</span>
      {hit.hasPhotos && <Camera className="ml-1.5 size-3.5 shrink-0 text-muted-foreground" aria-label="ze zdjęciem" />}
      {hit.siteName && <span className="ml-auto shrink-0 pl-3 text-xs text-muted-foreground">{hit.siteName}</span>}
    </CommandItem>
  );
}
