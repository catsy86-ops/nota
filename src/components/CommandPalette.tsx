import { useMemo, useState } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Inbox, Lock, LockOpen, StickyNote, Archive, Bell, Trash, Plus, Moon, Settings, Trophy, Calendar, CalendarRange, BriefcaseBusiness, HardHat, HandCoins, Dumbbell, Brain, Keyboard, BookOpen, RotateCcwClock, Bookmark, Network, Copy } from "lucide-react";
import { requestLinkGraph } from "@/lib/graphRequest";
import type { Note } from "@/hooks/useNotes";
import { searchNotes, useSearchReady } from "@/lib/searchNotes";
import type { PeriodKind } from "@/lib/periodNote";
import { loadRecentSearches, saveRecentSearch } from "@/lib/recentSearches";
import { loadRecentCommands, saveRecentCommand } from "@/lib/recentCommands";
import { requestShiftDay, searchShiftDays, useShifts } from "@/lib/shifts";
import { modShortcut } from "@/lib/platform";
import { useNotesContext } from "@/hooks/NotesProvider";
import { useSavedFilters } from "@/lib/savedFilters";
import { useVault } from "@/hooks/usePrivateNotes";
import { privateNotes } from "@/lib/privateNotes";
import { lockEverywhere } from "@/lib/vaultAutoLock";
import { vaultUi } from "@/lib/vaultUi";

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
  onNewNote: () => void;
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
}

type NavItem = { id: Parameters<Props["onGo"]>[0]; label: string; Icon: typeof StickyNote; hint?: string };
const NAV_ITEMS: NavItem[] = [
  { id: "notes", label: "Notatki", Icon: StickyNote },
  { id: "inbox", label: "Skrzynka", Icon: Inbox },
  { id: "today", label: "Dziś", Icon: Calendar, hint: "Alt+T" },
  { id: "reminders", label: "Przypomnienia", Icon: Bell },
  { id: "calendar", label: "Kalendarz", Icon: CalendarRange },
  { id: "shifts", label: "Grafik zmian", Icon: BriefcaseBusiness },
  { id: "study", label: "Praca", Icon: HardHat },
  { id: "debts", label: "Długi", Icon: HandCoins },
  { id: "cwiczenia", label: "Ćwiczenia", Icon: Dumbbell },
  { id: "archive", label: "Archiwum", Icon: Archive },
  { id: "trash", label: "Kosz", Icon: Trash },
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
  const vault = useVault();
  const shifts = useShifts();
  const shiftHits = useMemo(() => {
    const types = new Map(shifts.types.map((x) => [x.id, x]));
    return searchShiftDays(search, shifts.days, types);
  }, [shifts, search]);

  // Nawigacja jako dane: ta sama lista rysuje grupę i „Ostatnio użyte”.
  const navKnown = NAV_ITEMS.map((n) => n.id);
  const [recentCmds, setRecentCmds] = useState<string[]>(() => loadRecentCommands(navKnown));
  const recentNav = recentCmds.map((id) => NAV_ITEMS.find((n) => n.id === id)).filter((n): n is NavItem => n !== undefined);
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
                onClick={() => run(onNewNote)}
                className="flex items-center gap-1.5 text-xs text-primary-ink hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Utwórz notatkę „{search.trim()}”
              </button>
            )}
          </div>
        </CommandEmpty>
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
          {NAV_ITEMS.map((n) => (
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
