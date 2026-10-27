import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { FINISH_SHIFT_NOW_EVENT } from "@/lib/shiftCommands";
import { Inbox, Lock, LockOpen, StickyNote, Archive, Bell, Trash, Plus, Moon, Settings, Trophy, Calendar, CalendarRange, BriefcaseBusiness, HardHat, HandCoins, Dumbbell, Brain, Keyboard, BookOpen, RotateCcwClock, Bookmark, Network, Copy, Heading, Hash, Pin, Clock } from "lucide-react";
import { requestLinkGraph } from "@/lib/graphRequest";
import type { Note } from "@/hooks/useNotes";
import { searchNotes, useSearchReady } from "@/lib/searchNotes";
import { sectionHits } from "@/lib/sectionHits";
import { requestHeading } from "@/lib/wikiHeading";
import type { PeriodKind } from "@/lib/periodNote";
import { loadRecentSearches, saveRecentSearch } from "@/lib/recentSearches";
import { loadRecentCommands, saveRecentCommand } from "@/lib/recentCommands";
import { requestShiftDay, searchShiftDays, useShifts } from "@/lib/shifts";
import { requestShiftAction } from "@/lib/shifts/shiftActions";
import { modShortcut } from "@/lib/platform";
import { useNotesContext } from "@/hooks/NotesProvider";
import { useSavedFilters } from "@/lib/savedFilters";
import { useVault } from "@/hooks/usePrivateNotes";
import { privateNotes } from "@/lib/privateNotes";
import { lockEverywhere } from "@/lib/vaultAutoLock";
import { vaultUi } from "@/lib/vaultUi";
import { useSiteDirectory, useStudy } from "@/lib/study/store";
import { siteCardUrl } from "@/lib/study/siteLink";
import { JOURNAL_REPORT_PARAM, reportParam } from "@/lib/study/reportLink";
import { entrySiteId, foldName } from "@/lib/study/siteKey";
import { isViewShown, useHiddenViews } from "@/lib/hiddenViews";
import { viewLabel } from "@/lib/viewMeta";
import { dayKey } from "@/lib/reminderOccurrences";
import { addDays } from "date-fns";

const NOTE_LIMIT = 30;

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
  onGo: (view: "notes" | "inbox" | "today" | "week" | "archive" | "reminders" | "calendar" | "shifts" | "study" | "debts" | "cwiczenia" | "trash" | "widget") => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenStats: () => void;
  onOpenFocusMode: () => void;
  onOpenShortcuts: () => void;
  onGoFilter: (query: string) => void;
  /** Jest tylko, gdy jest „bieżąca” notatka (otwarta w czytniku, zaznaczona lub z fokusem). */
  onCopyNote?: (format: "markdown" | "text") => void;
  /** Bieżąca notatka (czytnik, zaznaczenie lub fokus): jej akcje idą na górę palety (plan 3.9). */
  currentNote?: Note | null;
  onTogglePin?: (id: string) => void;
  /** Widok z adresu: w Grafiku paleta pokazuje akcje zmiany. */
  view?: string;
}

type NavItem = { id: Parameters<Props["onGo"]>[0]; label: string; Icon: typeof StickyNote; hint?: string };
const NAV_ITEMS: NavItem[] = [
  { id: "notes", label: viewLabel("notes"), Icon: StickyNote },
  { id: "inbox", label: viewLabel("inbox"), Icon: Inbox },
  { id: "today", label: viewLabel("today"), Icon: Calendar, hint: "Alt+T" },
  { id: "reminders", label: viewLabel("reminders"), Icon: Bell },
  { id: "calendar", label: viewLabel("calendar"), Icon: CalendarRange },
  { id: "shifts", label: viewLabel("shifts"), Icon: BriefcaseBusiness },
  { id: "study", label: viewLabel("study"), Icon: HardHat },
  { id: "debts", label: viewLabel("debts"), Icon: HandCoins },
  { id: "cwiczenia", label: viewLabel("cwiczenia"), Icon: Dumbbell },
  { id: "archive", label: viewLabel("archive"), Icon: Archive },
  { id: "trash", label: viewLabel("trash"), Icon: Trash },
];

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
  onOpenFocusMode,
  onOpenShortcuts,
  onGoFilter,
  onCopyNote,
  currentNote,
  onTogglePin,
  view,
}: Props) {
  const { folders } = useNotesContext();
  const { filters } = useSavedFilters();
  const [search, setSearch] = useState("");
  // Ostatnie zapytania, które zakończyły się otwarciem notatki (max 5, localStorage).
  const [recent, setRecent] = useState<string[]>(loadRecentSearches);
  // Notatki prywatne nie pojawiają się w palecie (ani tytułem, ani treścią) — także po odblokowaniu.
  const publicNotes = useMemo(() => notes.filter((n) => !n.locked), [notes]);
  const searchReady = useSearchReady();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `searchReady`: przeliczenie po wczytaniu silnika
  const matched = useMemo(() => searchNotes(publicNotes, search, { folders }), [publicNotes, search, folders, searchReady]);
  // Nagłówki i bloki pasujące do tekstu (bez operatorów): skok prosto do sekcji.
  const sections = useMemo(() => sectionHits(publicNotes, search, { folders }), [publicNotes, search, folders]);
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
  const shifts = useShifts();
  const shiftHits = useMemo(() => {
    const types = new Map(shifts.types.map((x) => [x.id, x]));
    return searchShiftDays(search, shifts.days, types);
  }, [shifts, search]);

  // Nawigacja jako dane: ta sama lista rysuje grupę i „Ostatnio użyte”.
  const hiddenViews = useHiddenViews();
  const navKnown = NAV_ITEMS.map((n) => n.id);
  const [recentCmds, setRecentCmds] = useState<string[]>(() => loadRecentCommands(navKnown));
  const recentNav = recentCmds.map((id) => NAV_ITEMS.find((n) => n.id === id)).filter((n): n is NavItem => n !== undefined && isViewShown(hiddenViews, n.id));
  function goNav(id: NavItem["id"]) {
    setRecentCmds(saveRecentCommand(navKnown, id));
    onGo(id);
  }

  function run(fn: () => void) {
    onOpenChange(false);
    setTimeout(fn, 0);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Szukaj notatek, dni grafiku lub akcji…" value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-2">
            <span>Brak wyników.</span>
            {search.trim() && (
              <button
                type="button"
                onClick={() => run(() => onNewNote(search.trim()))}
                className="flex items-center gap-1.5 text-xs text-primary-ink hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Utwórz notatkę „{search.trim()}”
              </button>
            )}
          </div>
        </CommandEmpty>
        {currentNote && !search.trim() && (
          <>
            <CommandGroup heading="Ta notatka">
              <CommandItem value="ta notatka otwórz" onSelect={() => run(() => onOpenNote(currentNote.id))}>
                <StickyNote className="w-4 h-4 mr-2" /> Otwórz
              </CommandItem>
              {onTogglePin && (
                <CommandItem value={currentNote.pinned ? "ta notatka odepnij" : "ta notatka przypnij"} onSelect={() => run(() => onTogglePin(currentNote.id))}>
                  <Pin className="w-4 h-4 mr-2" /> {currentNote.pinned ? "Odepnij" : "Przypnij"}
                </CommandItem>
              )}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {view === "shifts" && !search.trim() && (
          <>
            <CommandGroup heading="Grafik">
              <CommandItem value="grafik skończyłem teraz koniec zmiany" onSelect={() => run(() => window.dispatchEvent(new Event(FINISH_SHIFT_NOW_EVENT)))}>
                <Clock className="w-4 h-4 mr-2" /> Skończyłem teraz
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
                  <n.Icon className="w-4 h-4 mr-2" /> {n.label}
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
                  <RotateCcwClock className="w-4 h-4 mr-2 text-muted-foreground" />
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
                  <Bookmark className="w-4 h-4 mr-2" />
                  <span className="truncate">{f.name}</span>
                  <span className="ml-auto pl-3 text-xs text-muted-foreground truncate max-w-[40%]">{f.query}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {(studyHits.sites.length > 0 || studyHits.entries.length > 0) && (
          <>
            {studyHits.sites.length > 0 && (
              <CommandGroup heading="Budowy">
                {studyHits.sites.map((x) => (
                  <CommandItem key={`site-${x.id}`} value={`budowa ${x.name}`} onSelect={() => run(() => navigate(siteCardUrl(x.id)))}>
                    <HardHat className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span className="truncate">Karta budowy: {x.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {studyHits.entries.length > 0 && (
              <CommandGroup heading="Wpisy w Pracy">
                {studyHits.entries.map((e) => {
                  const id = entrySiteId(e);
                  return (
                    <CommandItem key={`entry-${e.id}`} value={`wpis ${e.text} ${e.site}`} onSelect={() => run(() => navigate(id ? siteCardUrl(id) : "/praca"))}>
                      <HardHat className="w-4 h-4 mr-2 text-muted-foreground" />
                      <span className="truncate">{e.text.slice(0, 60) || "bez opisu"}</span>
                      {e.site && <span className="ml-auto text-xs text-muted-foreground">{e.site}</span>}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            <CommandSeparator />
          </>
        )}
        {/* Adres dnia kalendarza (K1.5): „Dziś” i „Jutro” z palety otwierają kalendarz na właściwym dniu. */}
        <CommandGroup heading={viewLabel("calendar")}>
          <CommandItem value="kalendarz terminy dziś" onSelect={() => run(() => navigate(`/kalendarz?dzien=${dayKey(new Date())}`))}>
            <Calendar className="w-4 h-4 mr-2 text-muted-foreground" /> Terminy na dziś
          </CommandItem>
          <CommandItem value="kalendarz terminy jutro" onSelect={() => run(() => navigate(`/kalendarz?dzien=${dayKey(addDays(new Date(), 1))}`))}>
            <Calendar className="w-4 h-4 mr-2 text-muted-foreground" /> Terminy na jutro
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Praca">
          <CommandItem value="praca nowy wpis" onSelect={() => run(() => navigate("/praca?wpis=1"))}>
            <Plus className="w-4 h-4 mr-2 text-muted-foreground" /> Nowy wpis w Pracy
          </CommandItem>
          <CommandItem value="praca raport dnia" onSelect={() => run(() => navigate(`/praca?${JOURNAL_REPORT_PARAM}=${reportParam({ range: "day", allSites: false })}`))}>
            <HardHat className="w-4 h-4 mr-2 text-muted-foreground" /> Raport dnia
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading={viewLabel("shifts")}>
          <CommandItem value="grafik dodaj zmiane dzis" onSelect={() => run(() => { requestShiftAction("addToday"); onGo("shifts"); })}>
            Dodaj zmianę dziś
          </CommandItem>
          <CommandItem value="grafik nałóż cykl" onSelect={() => run(() => { requestShiftAction("pattern"); onGo("shifts"); })}>
            Nałóż cykl zmian
          </CommandItem>
          <CommandItem value="grafik obraz miesiaca png" onSelect={() => run(() => { requestShiftAction("image"); onGo("shifts"); })}>
            Obraz miesiąca (PNG)
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Akcje">
          <CommandItem onSelect={() => run(onNewNote)}>
            <Plus className="w-4 h-4 mr-2" /> Nowa notatka <span className="ml-auto text-xs text-muted-foreground">{modShortcut("N")}</span>
          </CommandItem>
          <CommandItem onSelect={() => run(onDailyNote)}>
            <BookOpen className="w-4 h-4 mr-2" /> Notatka dnia
          </CommandItem>
          <CommandItem value="notatka tygodnia" onSelect={() => run(() => onPeriodNote("week"))}>
            <CalendarRange className="w-4 h-4 mr-2" /> Notatka tygodnia
          </CommandItem>
          <CommandItem value="notatka miesiaca" onSelect={() => run(() => onPeriodNote("month"))}>
            <CalendarRange className="w-4 h-4 mr-2" /> Notatka miesiąca
          </CommandItem>
          {onCopyNote && (
            <>
              <CommandItem value="kopiuj notatke jako markdown" onSelect={() => run(() => onCopyNote("markdown"))}>
                <Copy className="w-4 h-4 mr-2" /> Kopiuj notatkę jako Markdown
              </CommandItem>
              <CommandItem value="kopiuj notatke jako tekst" onSelect={() => run(() => onCopyNote("text"))}>
                <Copy className="w-4 h-4 mr-2" /> Kopiuj notatkę jako tekst
              </CommandItem>
            </>
          )}
          {vault.phase === "unlocked" && (
            <CommandItem value="zablokuj prywatne notatki teraz" onSelect={() => run(() => { void lockEverywhere(privateNotes); })}>
              <Lock className="w-4 h-4 mr-2" /> Zablokuj prywatne notatki teraz
            </CommandItem>
          )}
          {vault.phase === "locked" && (
            <CommandItem value="odblokuj prywatne notatki" onSelect={() => run(() => vaultUi.open("unlock"))}>
              <LockOpen className="w-4 h-4 mr-2" /> Odblokuj prywatne notatki
            </CommandItem>
          )}
          <CommandItem onSelect={() => run(onOpenSettings)}>
            <Settings className="w-4 h-4 mr-2" /> Ustawienia
          </CommandItem>
          <CommandItem onSelect={() => run(onOpenStats)}>
            <Trophy className="w-4 h-4 mr-2" /> Statystyki i osiągnięcia
          </CommandItem>
          <CommandItem onSelect={() => run(() => { requestLinkGraph(); onOpenStats(); })}>
            <Network className="w-4 h-4 mr-2" /> Graf powiązań
          </CommandItem>
          <CommandItem onSelect={() => run(onOpenFocusMode)}>
            <Brain className="w-4 h-4 mr-2" /> Tryb skupienia
          </CommandItem>
          <CommandItem onSelect={() => run(onToggleTheme)}>
            <Moon className="w-4 h-4 mr-2" /> Przełącz motyw jasny/ciemny
          </CommandItem>
          <CommandItem onSelect={() => run(onOpenShortcuts)}>
            <Keyboard className="w-4 h-4 mr-2" /> Skróty klawiszowe <span className="ml-auto text-xs text-muted-foreground">?</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Nawigacja">
          {NAV_ITEMS.filter((n) => isViewShown(hiddenViews, n.id)).map((n) => (
            <CommandItem key={n.id} value={`nawigacja ${n.label}`} onSelect={() => run(() => goNav(n.id))}>
              <n.Icon className="w-4 h-4 mr-2" /> {n.label}
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
                  <BriefcaseBusiness className="w-4 h-4 mr-2 text-muted-foreground" />
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
                  {h.kind === "heading" ? <Heading className="w-4 h-4 mr-2 text-muted-foreground" /> : <Hash className="w-4 h-4 mr-2 text-muted-foreground" />}
                  <span className="truncate">{h.text}</span>
                  <span className="ml-2 truncate text-xs text-muted-foreground">{h.note.title || "(bez tytułu)"}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {matched.length > 0 && (
          <>
            <CommandSeparator />
            {/* Filtruje `searchNotes` (ten sam silnik co pasek wyszukiwania, z
                checklistami i operatorami), a dopiero potem tniemy — inaczej
                paleta widziałaby tylko 30 najnowszych notatek. `forceMount`, bo
                wynik wyszukiwania nie musi przejść wewnętrznego filtra cmdk. */}
            <CommandGroup
              heading={matched.length > NOTE_LIMIT ? `Notatki — pokazano ${NOTE_LIMIT} z ${matched.length}` : "Notatki"}
              forceMount={matched.length > 0}
            >
              {matched.slice(0, NOTE_LIMIT).map((n) => (
                <CommandItem key={n.id} forceMount value={`note-${n.id}`} onSelect={() => { setRecent(saveRecentSearch(search)); run(() => onOpenNote(n.id)); }}>
                  <StickyNote className="w-4 h-4 mr-2 text-muted-foreground" />
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
