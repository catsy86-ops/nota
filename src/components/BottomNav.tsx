import { forwardRef, useRef, useState } from "react";
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
import { spring } from "@/lib/motion";
import { useMotionPref } from "@/hooks/useMotionPref";
import { useSavedFilters, sameQuery } from "@/lib/savedFilters";
import { preloadView } from "@/lib/viewPreload";

import type { View } from "@/hooks/useFilteredNotes";

interface BottomNavProps {
  view: View;
  onGo: (v: View) => void;
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

const slots = [
  { key: "notes" as View, label: "Notatki", Icon: StickyNote },
  { key: "today" as View, label: "Dziś", Icon: CalendarDays },
] as const;

const slotsRight = [
  // „Terminy” (D3): pełne „Przypomnienia” nie mieściło się w kolumnie przy podpisach 12 px; nagłówek widoku bez zmian.
  { key: "reminders" as View, label: "Terminy", Icon: Bell },
] as const;

export function BottomNav({ view, onGo, onNew, onOpenSettings, onOpenActions, trashCount = 0, inboxCount = 0, dark = false, onToggleTheme, onImport, onGoFilter, search = "" }: BottomNavProps) {
  const { filters } = useSavedFilters();
  const [moreOpen, setMoreOpen] = useState(false);
  // Długie przytrzymanie „+” otwiera arkusz „Nowa”: lista, dyktowanie, zdjęcie, rysunek.
  const [quickOpen, setQuickOpen] = useState(false);
  const pressTimer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);
  const canDictate = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const startPress = () => {
    longPressed.current = false;
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      haptic("tap");
      setQuickOpen(true);
    }, 420);
  };
  const cancelPress = () => window.clearTimeout(pressTimer.current);
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
  const isMoreActive = ["inbox", "archive", "trash", "calendar", "shifts", "study", "debts", "cwiczenia", "folder", "label"].includes(view);

  return (
    <>
      <motion.nav
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={spring.soft}
        className="fixed bottom-0 inset-x-0 z-40 desk:hidden glass-strong border-t border-border/60 pb-[env(safe-area-inset-bottom)] shadow-elevation-up transition-[translate,visibility] duration-200 ease-out motion-reduce:transition-none in-data-typing:translate-y-full in-data-typing:invisible"
      >
        <LayoutGroup id="bottom-nav">
          <ul className="relative grid grid-cols-5 items-end h-[64px] max-w-md mx-auto px-2">
            {slots.map(({ key, label, Icon }) => (
              <NavItem key={key} active={view === key} label={label} onClick={() => (key === "notes" && view === "notes" ? focusSearch() : onGo(key))}>
                <Icon className="w-5 h-5" />
              </NavItem>
            ))}

            {/* Center FAB */}
            <li className="flex justify-center -mt-6">
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
                <motion.span
                  aria-hidden
                  className="relative z-10 flex"
                  animate={{ rotate: reduced ? 0 : quarterTurns * 90 }}
                  transition={spring.snap}
                >
                  <Plus className="w-6 h-6" />
                </motion.span>
              </motion.button>
            </li>

            {slotsRight.map(({ key, label, Icon }) => (
              <NavItem key={key} active={view === key} label={label} onClick={() => onGo(key)}>
                <Icon className="w-5 h-5" />
              </NavItem>
            ))}

            <NavItem active={isMoreActive || moreOpen} current={false} label="Więcej" onClick={() => setMoreOpen(true)} buttonProps={{ "aria-haspopup": "dialog", "aria-expanded": moreOpen }}>
              <Ellipsis className="w-5 h-5" />
            </NavItem>
          </ul>
        </LayoutGroup>
      </motion.nav>

      <Sheet open={quickOpen} onOpenChange={setQuickOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+16px)] border-t border-border/60">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-2xl">Nowa</SheetTitle>
            <SheetDescription>Co zapisać? Stuknij „+”, by od razu napisać notatkę.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-2 gap-2.5" role="group" aria-label="Rodzaj nowej notatki">
            <QuickTile Icon={Plus} title="Notatka" hint="Pusta kartka do pisania" tone="primary" onClick={() => { setQuickOpen(false); onNew("note"); }} />
            <QuickTile Icon={ListChecks} title="Lista zadań" hint="Punkty do odhaczenia" tone="success" onClick={() => { setQuickOpen(false); onNew("list"); }} />
            {canDictate && <QuickTile Icon={Mic} title="Dyktuj" hint="Mów, a zamienię na tekst" tone="warning" onClick={() => { setQuickOpen(false); onNew("dictate"); }} />}
            <QuickTile Icon={ImagePlus} title="Zdjęcie" hint="Z aparatu albo galerii" tone="primary" onClick={() => { setQuickOpen(false); onNew("image"); }} />
            <QuickTile Icon={PenTool} title="Rysunek" hint="Szkic palcem lub rysikiem" tone="success" onClick={() => { setQuickOpen(false); onNew("draw"); }} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+16px)] border-t border-border/60">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display">Więcej</SheetTitle>
          </SheetHeader>
          <SheetGroup title="Szybko">
            <SheetTile Icon={Plus} label="Dodaj…" onClick={() => { setMoreOpen(false); setQuickOpen(true); }} />
            {/* Po zamknięciu arkusza fokus wraca na „Więcej” — kursor w wyszukiwarce dopiero po tym. */}
            <SheetTile Icon={Search} label="Szukaj" onClick={() => { setMoreOpen(false); onGo("notes"); window.setTimeout(focusSearch, 400); }} />
          </SheetGroup>
          <SheetGroup title="Przejdź do">
            <SheetTile Icon={Inbox} label="Skrzynka" active={view === "inbox"} badge={inboxCount || undefined} onClick={() => { onGo("inbox"); setMoreOpen(false); }} />
            <SheetTile Icon={Archive} label="Archiwum" active={view === "archive"} onClick={() => { onGo("archive"); setMoreOpen(false); }} />
            <SheetTile Icon={Trash} label="Kosz" active={view === "trash"} badge={trashCount || undefined} onClick={() => { onGo("trash"); setMoreOpen(false); }} />
            <SheetTile Icon={CalendarRange} label="Kalendarz" active={view === "calendar"} onPointerDown={() => preloadView("calendar")} onClick={() => { onGo("calendar"); setMoreOpen(false); }} />
            <SheetTile Icon={BriefcaseBusiness} label="Grafik" active={view === "shifts"} onPointerDown={() => preloadView("shifts")} onClick={() => { onGo("shifts"); setMoreOpen(false); }} />
            <SheetTile Icon={HardHat} label="Praca" active={view === "study"} onPointerDown={() => preloadView("study")} onClick={() => { onGo("study"); setMoreOpen(false); }} />
            <SheetTile Icon={HandCoins} label="Długi" active={view === "debts"} onClick={() => { onGo("debts"); setMoreOpen(false); }} />
            <SheetTile Icon={Dumbbell} label="Ćwiczenia" active={view === "cwiczenia"} onClick={() => { onGo("cwiczenia"); setMoreOpen(false); }} />
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
          "pressable relative w-full flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-xs font-display outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
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
              className="absolute inset-x-3 top-1 h-8 rounded-xl bg-primary/20"
              transition={spring.snap}
            />
          </>
        )}
        <span className="relative z-10">{children}</span>
        <span className="relative z-10 whitespace-nowrap leading-none tracking-tight">{label}</span>
        {!!badge && (
          <span className="absolute top-0.5 right-1/4 min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-primary-foreground text-2xs font-semibold flex items-center justify-center z-10">
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
const QUICK_TONE: Record<QuickTone, string> = {
  primary: "bg-primary/15 text-primary-ink",
  success: "bg-success/15 text-success-ink",
  warning: "bg-warning/15 text-warning-ink",
};

/** Kafel w arkuszu „Nowa”: ikona w kolorze rodzaju, tytuł i jedno zdanie, co się stanie. */
function QuickTile({ Icon, title, hint, tone, onClick }: { Icon: React.ComponentType<{ className?: string }>; title: string; hint: string; tone: QuickTone; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable group flex items-center gap-3 rounded-card border border-border/60 bg-card p-3.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-transform duration-200 group-hover:-rotate-6 motion-reduce:transition-none", QUICK_TONE[tone])} aria-hidden>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{hint}</span>
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
      <span className="w-10 h-10 rounded-xl bg-background flex items-center justify-center text-primary-ink">
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
