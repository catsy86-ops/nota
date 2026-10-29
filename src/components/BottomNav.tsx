import { forwardRef, useEffect, useRef, useState } from "react";
import { m as motion, LayoutGroup } from "framer-motion";
import { StickyNote, CalendarDays, Plus, Ellipsis, Archive, Trash, Settings as SettingsIcon, Bell, CircleQuestionMark, RotateCcwClock, CalendarRange, BriefcaseBusiness, HardHat, HandCoins, Dumbbell, Inbox, Moon, Sun, FileDown, Bookmark, ListChecks, Mic, ImagePlus, PenTool, Search } from "lucide-react";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import { openJournalSheet } from "@/lib/study/entrySheet";
import type { ComposerAction } from "@/components/AddNoteBar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { InstallAppButton } from "@/components/InstallAppButton";
import { ImportExportMenu } from "@/components/ImportExportMenu";
import { cn } from "@/lib/utils";
import { sectionIconClass } from "@/lib/sections";
import { spring } from "@/lib/motion";
import { useMotionPref } from "@/hooks/useMotionPref";
import { useSavedFilters, sameQuery } from "@/lib/savedFilters";
import { preloadView } from "@/lib/viewPreload";
import { orderByRecent, readLastQuick, writeLastQuick, type QuickKind } from "@/lib/fabRecent";

import type { View } from "@/hooks/useFilteredNotes";
import { isViewShown, useHiddenViews } from "@/lib/hiddenViews";
import { useBottomSlot, type BottomSlotView } from "@/lib/bottomSlot";

interface BottomNavProps {
  view: View;
  onGo: (v: View) => void;
  /** Lupa w widokach bez pola szukania — otwiera paletę poleceń. */
  onOpenPalette?: () => void;
  /** Bez argumentu: zwykła notatka. Z argumentem: edytor od razu robi to, co wybrano. */
  onNew: (action?: ComposerAction) => void;
  onOpenSettings: () => void;
  onOpenActions?: () => void;
  trashCount?: number;
  /** Liczba notatek do posortowania (licznik przy Skrzynce w menu „Więcej”). */
  inboxCount?: number;
  dark?: boolean;
  onToggleTheme?: () => void;
  /** Import z JSON — eksport i import są na telefonie tutaj, nie w nagłówku. */
  onImport?: () => void;
  /** Zapisane filtry w arkuszu „Więcej”: kafel ustawia widok Notatki z tym zapytaniem. */
  onGoFilter?: (query: string) => void;
  search?: string;
}

import { viewHasSearch } from "@/lib/viewSearch";

const slots = [
  { key: "notes" as View, label: "Notatki", Icon: StickyNote },
  { key: "today" as View, label: "Dziś", Icon: CalendarDays },
] as const;

const SLOT_META: Record<BottomSlotView, { label: string; Icon: typeof Bell }> = {
  reminders: { label: "Terminy", Icon: Bell },
  shifts: { label: "Grafik", Icon: BriefcaseBusiness },
  study: { label: "Praca", Icon: HardHat },
  calendar: { label: "Kalendarz", Icon: CalendarRange },
  inbox: { label: "Skrzynka", Icon: Inbox },
};

// Prawa pozycja (2.3): wybór z Ustawień, domyślnie Terminy.

export function BottomNav({ view, onGo, onOpenPalette, onNew, onOpenSettings, onOpenActions, trashCount = 0, inboxCount = 0, dark = false, onToggleTheme, onImport, onGoFilter, search = "" }: BottomNavProps) {
  const { filters } = useSavedFilters();
  const [moreOpen, setMoreOpen] = useState(false);
  const hiddenViews = useHiddenViews();
  const bottomSlot = useBottomSlot();
  // Długie przytrzymanie „+” otwiera arkusz „Nowa”: lista, dyktowanie, zdjęcie, rysunek.
  const [quickOpen, setQuickOpen] = useState(false);
  // F1.3: ostatnio wybrany rodzaj z arkusza „Nowa” (wraca na górę i dostaje odznakę).
  const [lastQuick, setLastQuick] = useState<QuickKind | null>(readLastQuick);
  // F1.4: na liście notatek „+” chowa się przy przewijaniu w dół i wraca przy przewijaniu w górę.
  const [fabHidden, setFabHidden] = useState(false);
  useEffect(() => {
    if (view !== "notes") { setFabHidden(false); return; }
    let last = window.scrollY;
    let run = 0; // przesunięcie w bieżącym kierunku; zmiana kierunku je zeruje
    const onScroll = () => {
      const y = window.scrollY;
      const d = y - last;
      last = y;
      if (y < 80) { run = 0; setFabHidden(false); return; }
      if (Math.sign(d) !== Math.sign(run)) run = 0;
      run += d;
      if (run > 24) setFabHidden(true);
      else if (run < -12) setFabHidden(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [view]);
  const pressTimer = useRef<number | undefined>(undefined);
  // F1.1: pierścień postępu wokół „+” w trakcie przytrzymania (animacja CSS `fab-ring`, 420 ms).
  const [pressing, setPressing] = useState(false);
  const longPressed = useRef(false);
  const canDictate = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const startPress = () => {
    longPressed.current = false;
    window.clearTimeout(pressTimer.current);
    setPressing(true);
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setPressing(false);
      haptic("tap");
      setQuickOpen(true);
    }, 420);
  };
  const cancelPress = () => {
    window.clearTimeout(pressTimer.current);
    setPressing(false);
  };
  // Podpowiedź o przytrzymaniu „+” — raz, już przy pierwszym stuknięciu (wcześniej dopiero po czwartym).
  const hintOnce = () => {
    try {
      if (localStorage.getItem("kaczy.fab.hint.v1")) return;
      localStorage.setItem("kaczy.fab.hint.v1", "1");
      toast("Przytrzymaj „+”, by od razu dodać listę, zdjęcie, rysunek albo dyktować", { duration: 6000 });
    } catch { /* brak localStorage — bez podpowiedzi */ }
  };
  // Każde dotknięcie „+” obraca ikonę o ćwierć obrotu — cichy znak, że edytor się otwiera.
  const [quarterTurns, setQuarterTurns] = useState(0);
  const { reduced } = useMotionPref();
  // Wyszukiwarka jest u góry, poza zasięgiem kciuka: ponowne stuknięcie „Notatki” przewija na górę
  // i ustawia w niej kursor (synchronicznie w geście — iOS otworzy wtedy klawiaturę).
  const focusSearch = () => {
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    const input = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="search"]')).find((el) => el.offsetParent !== null);
    input?.focus({ preventScroll: true });
  };
  // Szósta komórka (lupa) tylko tam, gdzie nie ma pola szukania; FAB zostaje w środku paska wtedy przesunięty o pół komórki.
  const showPaletteSlot = !viewHasSearch(view) && !!onOpenPalette;
  const isMoreActive = ["inbox", "archive", "trash", "calendar", "shifts", "study", "debts", "cwiczenia", "folder", "label"].includes(view);

  return (
    <>
      <motion.nav
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={spring.soft}
        className="fixed bottom-0 inset-x-0 z-overlay desk:hidden glass-strong border-t border-border/60 pb-[env(safe-area-inset-bottom)] shadow-elevation-up transition-[translate,visibility] duration-200 ease-out motion-reduce:transition-none in-data-typing:translate-y-full in-data-typing:invisible"
      >
        <LayoutGroup id="bottom-nav">
          <ul className={cn("relative grid items-end h-[64px] max-w-md mx-auto px-2", showPaletteSlot ? "grid-cols-6" : "grid-cols-5")}>
            {slots.map(({ key, label, Icon }) => (
              <NavItem key={key} active={view === key} label={label} onClick={() => (key === "notes" && view === "notes" ? focusSearch() : onGo(key))}>
                <Icon className={cn("w-5 h-5", sectionIconClass(key))} />
              </NavItem>
            ))}

            {/* Center FAB */}
            <motion.li
              className="flex justify-center -mt-6"
              data-fab-hidden={fabHidden}
              animate={{ y: fabHidden ? 88 : 0, opacity: fabHidden ? 0 : 1 }}
              transition={reduced ? { duration: 0 } : spring.soft}
              style={{ pointerEvents: fabHidden ? "none" : undefined }}
            >
              <motion.button
                whileTap={reduced ? undefined : { scale: 0.92 }}
                transition={spring.snap}
                onPointerDown={startPress}
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                onPointerCancel={cancelPress}
                onContextMenu={(e) => e.preventDefault()}
                onClick={() => {
                  if (longPressed.current) { longPressed.current = false; return; }
                  setQuarterTurns((n) => n + 1);
                  // Na /nauka „+” to wpis z budowy — notatkę dalej daje przytrzymanie.
                  if (view === "study") { haptic("tap"); openJournalSheet(); return; }
                  hintOnce();
                  onNew();
                }}
                aria-label={view === "study" ? "Nowy wpis z budowy" : "Nowa notatka"}
                title={view === "study" ? "Nowy wpis z budowy (przytrzymaj: nowa notatka)" : "Nowa notatka (przytrzymaj po więcej)"}
                className="relative w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-glow-primary ring-4 ring-background outline-hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                {/* Pierścień postępu (F1.1): rośnie przez 420 ms przytrzymania, zanika przy zwolnieniu. */}
                <svg aria-hidden viewBox="0 0 68 68" className="pointer-events-none absolute -inset-1.5 size-[calc(100%+12px)] -rotate-90">
                  <circle
                    className="fab-ring text-primary-foreground/80"
                    data-pressing={pressing}
                    data-testid="fab-ring"
                    cx="34" cy="34" r="31" pathLength={100}
                    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                  />
                </svg>
                <motion.span
                  aria-hidden
                  className="relative z-raised flex"
                  animate={{ rotate: reduced ? 0 : quarterTurns * 90 }}
                  transition={spring.snap}
                >
                  <Plus className="w-6 h-6" />
                </motion.span>
              </motion.button>
            </motion.li>

            {[{ key: bottomSlot as View, ...SLOT_META[bottomSlot] }].map(({ key, label, Icon }) => (
              <NavItem key={key} active={view === key} label={label} onClick={() => onGo(key)}>
                <Icon className="w-5 h-5" />
              </NavItem>
            ))}

            {showPaletteSlot && (
              <NavItem active={false} current={false} label="Szukaj" onClick={onOpenPalette}>
                <Search className="w-5 h-5" />
              </NavItem>
            )}
            <NavItem active={isMoreActive || moreOpen} current={false} label="Więcej" onClick={() => setMoreOpen(true)} buttonProps={{ "aria-haspopup": "dialog", "aria-expanded": moreOpen }}>
              <Ellipsis className="w-5 h-5" />
            </NavItem>
          </ul>
        </LayoutGroup>
      </motion.nav>

      <Sheet open={quickOpen} onOpenChange={setQuickOpen}>
        <SheetContent side="bottom" snap className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+16px)] border-t border-border/60">
          <SheetHeader className="text-left">
            <SheetTitle className="sheet-title-serif text-3xl">Nowa</SheetTitle>
            <SheetDescription>Co zapisać? Stuknij „+”, by od razu napisać notatkę.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-2" role="group" aria-label="Rodzaj nowej notatki">
            {orderByRecent(QUICK_TILES.filter((t) => t.kind !== "dictate" || canDictate), lastQuick).map((t, index) => (
              <QuickTile
                key={t.kind}
                index={index}
                Icon={t.Icon}
                title={t.title}
                hint={t.hint}
                tone={t.tone}
                recent={t.kind === lastQuick}
                onClick={() => { writeLastQuick(t.kind); setLastQuick(t.kind); setQuickOpen(false); onNew(t.kind); }}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" snap className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+16px)] border-t border-border/60">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display">Więcej</SheetTitle>
          </SheetHeader>
          <SheetGroup title="Szybko">
            <SheetTile Icon={Plus} label="Dodaj…" onClick={() => { setMoreOpen(false); setQuickOpen(true); }} />
            {/* Po zamknięciu arkusza fokus wraca na „Więcej” — kursor w wyszukiwarce dopiero po tym. */}
            <SheetTile Icon={Search} label="Szukaj" onClick={() => { setMoreOpen(false); onGo("notes"); window.setTimeout(focusSearch, 400); }} />
          </SheetGroup>
          <SheetGroup title="Przejdź do">
            {isViewShown(hiddenViews, "inbox") && <SheetTile Icon={Inbox} label="Skrzynka" active={view === "inbox"} badge={inboxCount || undefined} onClick={() => { onGo("inbox"); setMoreOpen(false); }} />}
            <SheetTile Icon={Archive} label="Archiwum" active={view === "archive"} onClick={() => { onGo("archive"); setMoreOpen(false); }} />
            <SheetTile Icon={Trash} label="Kosz" active={view === "trash"} badge={trashCount || undefined} onClick={() => { onGo("trash"); setMoreOpen(false); }} />
            {isViewShown(hiddenViews, "calendar") && <SheetTile Icon={CalendarRange} label="Kalendarz" active={view === "calendar"} onPointerDown={() => preloadView("calendar")} onFocus={() => preloadView("calendar")} onClick={() => { onGo("calendar"); setMoreOpen(false); }} />}
            {isViewShown(hiddenViews, "shifts") && <SheetTile Icon={BriefcaseBusiness} label="Grafik" active={view === "shifts"} onPointerDown={() => preloadView("shifts")} onFocus={() => preloadView("shifts")} onClick={() => { onGo("shifts"); setMoreOpen(false); }} />}
            {isViewShown(hiddenViews, "study") && <SheetTile Icon={HardHat} label="Praca" active={view === "study"} onPointerDown={() => preloadView("study")} onFocus={() => preloadView("study")} onClick={() => { onGo("study"); setMoreOpen(false); }} />}
            {isViewShown(hiddenViews, "debts") && <SheetTile Icon={HandCoins} label="Długi" active={view === "debts"} onClick={() => { onGo("debts"); setMoreOpen(false); }} />}
            {isViewShown(hiddenViews, "cwiczenia") && <SheetTile Icon={Dumbbell} label="Ćwiczenia" active={view === "cwiczenia"} onClick={() => { onGo("cwiczenia"); setMoreOpen(false); }} />}
          </SheetGroup>
          {onGoFilter && filters.length > 0 && (
            <SheetGroup title="Filtry">
              {filters.map((f) => (
                <SheetTile
                  key={f.id}
                  Icon={Bookmark}
                  label={f.name}
                  active={view === "notes" && sameQuery(search, f.query)}
                  onClick={() => { onGoFilter(f.query); setMoreOpen(false); }}
                />
              ))}
            </SheetGroup>
          )}
          <SheetGroup title="Narzędzia">
            {onOpenActions && <SheetTile Icon={RotateCcwClock} label="Ostatnie akcje" onClick={() => { onOpenActions(); setMoreOpen(false); }} />}
            <SheetTile Icon={CircleQuestionMark} label="Samouczek" onClick={() => { window.dispatchEvent(new CustomEvent("kaczy:tour")); setMoreOpen(false); }} />
            {onToggleTheme && <SheetTile Icon={dark ? Sun : Moon} label={dark ? "Tryb jasny" : "Tryb ciemny"} onClick={() => { onToggleTheme(); setMoreOpen(false); }} />}
            {onImport && (
              <ImportExportMenu onImport={onImport} onDone={() => setMoreOpen(false)} align="start">
                <SheetTile Icon={FileDown} label="Import / Eksport" />
              </ImportExportMenu>
            )}
            <SheetTile Icon={SettingsIcon} label="Ustawienia" onClick={() => { onOpenSettings(); setMoreOpen(false); }} />
            <InstallAppButton variant="tile" onDone={() => setMoreOpen(false)} />
          </SheetGroup>
        </SheetContent>
      </Sheet>
    </>
  );
}

function NavItem({ active, current = active, label, onClick, children, badge, buttonProps }: {
  active: boolean; current?: boolean; label: string; onClick: () => void; children: React.ReactNode; badge?: number;
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}) {
  return (
    <li className="relative">
      <button
        type="button"
        onClick={onClick}
        aria-current={current ? "page" : undefined}
        {...buttonProps}
        className={cn(
          "pressable relative w-full flex flex-col items-center justify-center gap-1 py-2 rounded-card text-xs font-display outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
          // Aktywna: kolor marki, pogrubiony podpis i grubsza kreska ikony — rozpoznawalna też bez koloru.
          active ? "text-primary-ink font-bold [&_svg]:stroke-[2.5]" : "text-muted-foreground font-medium hover:text-foreground"
        )}
      >
        {active && (
          <>
            {/* Pasek akcentu na górnej krawędzi paska nawigacji — widać go kątem oka, także w słońcu. */}
            <motion.span
              layoutId="bottom-nav-bar"
              aria-hidden
              className="absolute inset-x-5 -top-3 h-[3px] rounded-b-full bg-primary"
              transition={spring.snap}
            />
            <motion.span
              layoutId="bottom-nav-active"
              aria-hidden
              className="absolute inset-x-3 top-1 h-8 rounded-card bg-primary/20"
              transition={spring.snap}
            />
          </>
        )}
        <span className="relative z-raised">{children}</span>
        <span className="relative z-raised whitespace-nowrap leading-none tracking-tight">{label}</span>
        {!!badge && (
          <span className="absolute top-0.5 right-1/4 min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-primary-foreground text-2xs font-semibold flex items-center justify-center z-raised">
            {badge}
          </span>
        )}
      </button>
    </li>
  );
}

function SheetGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pt-4">
      <h3 className="section-caps px-1 pb-2">{title}</h3>
      <div className="grid grid-cols-3 gap-3">{children}</div>
    </section>
  );
}

type QuickTone = "primary" | "success" | "warning";
/** Pasek przy kaflu w barwie jego rodzaju (kolor z tokenów motywu). */
const QUICK_STRIPE: Record<QuickTone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
};

const QUICK_TONE: Record<QuickTone, string> = {
  primary: "bg-primary/15 text-primary-ink",
  success: "bg-success/15 text-success-ink",
  warning: "bg-warning/15 text-warning-ink",
};

/** Kafel w arkuszu „Nowa”: ikona w kolorze rodzaju, tytuł i jedno zdanie, co się stanie. */
/** Kafle arkusza „Nowa” w kolejności z planu FAB (D3); kolejność może się zmienić przez ostatnio użyty rodzaj (F1.3). */
const QUICK_TILES: { kind: QuickKind; Icon: React.ComponentType<{ className?: string }>; title: string; hint: string; tone: QuickTone }[] = [
  { kind: "note", Icon: Plus, title: "Notatka", hint: "Pusta kartka do pisania", tone: "primary" },
  { kind: "reminder", Icon: Bell, title: "Z przypomnieniem", hint: "Notatka z terminem od razu", tone: "warning" },
  { kind: "list", Icon: ListChecks, title: "Lista zadań", hint: "Punkty do odhaczenia", tone: "success" },
  { kind: "image", Icon: ImagePlus, title: "Zdjęcie", hint: "Z aparatu albo galerii", tone: "primary" },
  { kind: "draw", Icon: PenTool, title: "Rysunek", hint: "Szkic palcem lub rysikiem", tone: "success" },
  { kind: "dictate", Icon: Mic, title: "Dyktuj", hint: "Mów, a zamienię na tekst", tone: "warning" },
];

function QuickTile({ Icon, title, hint, tone, recent = false, index = 0, onClick }: { Icon: React.ComponentType<{ className?: string }>; title: string; hint: string; tone: QuickTone; recent?: boolean; index?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ "--i": index } as React.CSSProperties}
      className={cn("tile-enter pressable group relative flex items-center gap-3 overflow-hidden rounded-card border bg-card py-2.5 pl-4 pr-3 coarse:min-h-14 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 outline-hidden focus-visible:ring-2 focus-visible:ring-ring", recent ? "border-primary/50 bg-primary/5" : "border-border/60")}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", QUICK_STRIPE[tone])} />
      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-card transition-transform duration-200 group-hover:-rotate-6 motion-reduce:transition-none", QUICK_TONE[tone])} aria-hidden>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold text-foreground">{title}</span>
          {recent && <span className="rounded-full bg-primary/15 px-2 py-px text-2xs font-semibold text-primary-ink">Ostatnio</span>}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

type SheetTileProps = { Icon: React.ComponentType<{ className?: string }>; label: string; badge?: number; active?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>;

// forwardRef: kafel bywa wyzwalaczem menu (Import i eksport), a Radix podaje mu ref i własne propsy.
const SheetTile = forwardRef<HTMLButtonElement, SheetTileProps>(function SheetTile({ Icon, label, badge, active = false, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      aria-current={active ? "page" : undefined}
      className={cn(
        "pressable relative flex flex-col items-center gap-1.5 p-3 rounded-card border outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-primary/10 border-primary/40" : "bg-muted/50 hover:bg-muted border-border/50",
      )}
    >
      <span className="w-10 h-10 rounded-card bg-background flex items-center justify-center text-primary-ink">
        <Icon className="w-5 h-5" />
      </span>
      <span className="text-xs font-medium font-display leading-tight text-center text-foreground">{label}</span>
      {badge !== undefined && (
        <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-2xs font-semibold flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
});
