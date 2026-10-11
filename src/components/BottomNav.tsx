import { forwardRef, useRef, useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { StickyNote, CalendarDays, Plus, MoreHorizontal, Archive, Trash2, Settings as SettingsIcon, Bell, HelpCircle, History, CalendarRange, BriefcaseBusiness, GraduationCap, Moon, Sun, FileDown, Bookmark, ListChecks, Mic, ImagePlus, PenTool } from "lucide-react";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import type { ComposerAction } from "@/components/AddNoteBar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { InstallAppButton } from "@/components/InstallAppButton";
import { ImportExportMenu } from "@/components/ImportExportMenu";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { useMotionPref } from "@/hooks/useMotionPref";
import { useSavedFilters, sameQuery } from "@/lib/savedFilters";

import type { View } from "@/hooks/useFilteredNotes";

interface BottomNavProps {
  view: View;
  onGo: (v: View) => void;
  /** Bez argumentu: zwykła notatka. Z argumentem: edytor od razu robi to, co wybrano. */
  onNew: (action?: ComposerAction) => void;
  onOpenSettings: () => void;
  onOpenActions?: () => void;
  trashCount?: number;
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
  { key: "reminders" as View, label: "Przypomnienia", Icon: Bell },
] as const;

export function BottomNav({ view, onGo, onNew, onOpenSettings, onOpenActions, trashCount = 0, dark = false, onToggleTheme, onImport, onGoFilter, search = "" }: BottomNavProps) {
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
  const hintOnce = () => {
    try {
      if (localStorage.getItem("kaczy.fab.hint.v1")) return;
      const n = Number(localStorage.getItem("kaczy.fab.taps") ?? "0") + 1;
      localStorage.setItem("kaczy.fab.taps", String(n));
      if (n >= 4) {
        localStorage.setItem("kaczy.fab.hint.v1", "1");
        toast("Przytrzymaj „+”, by od razu dodać listę, zdjęcie, rysunek albo dyktować", { duration: 6000 });
      }
    } catch { /* brak localStorage — bez podpowiedzi */ }
  };
  // Każde dotknięcie „+” obraca ikonę o ćwierć obrotu — cichy znak, że edytor się otwiera.
  const [quarterTurns, setQuarterTurns] = useState(0);
  const { reduced } = useMotionPref();
  const isMoreActive = ["archive", "trash", "calendar", "shifts", "study", "folder", "label"].includes(view);

  return (
    <>
      <motion.nav
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={spring.soft}
        className="fixed bottom-0 inset-x-0 z-40 md:hidden glass-strong border-t border-border/60 pb-[env(safe-area-inset-bottom)] shadow-elevation-up"
      >
        <LayoutGroup id="bottom-nav">
          <ul className="relative grid grid-cols-5 items-end h-[64px] max-w-md mx-auto px-2">
            {slots.map(({ key, label, Icon }) => (
              <NavItem key={key} active={view === key} label={label} onClick={() => onGo(key)}>
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
                  hintOnce();
                  onNew();
                }}
                aria-label="Nowa notatka"
                title="Nowa notatka (przytrzymaj po więcej)"
                className="relative w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-glow-primary ring-4 ring-background outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
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
              <MoreHorizontal className="w-5 h-5" />
            </NavItem>
          </ul>
        </LayoutGroup>
      </motion.nav>

      <Sheet open={quickOpen} onOpenChange={setQuickOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+16px)] border-t border-border/60">
          <div aria-hidden className="mx-auto -mt-2 mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/25" />
          <SheetHeader className="text-left">
            <SheetTitle className="font-display">Nowa</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-3 gap-3" role="group" aria-label="Rodzaj nowej notatki">
            <SheetTile Icon={Plus} label="Notatka" onClick={() => { setQuickOpen(false); onNew("note"); }} />
            <SheetTile Icon={ListChecks} label="Lista zadań" onClick={() => { setQuickOpen(false); onNew("list"); }} />
            {canDictate && <SheetTile Icon={Mic} label="Dyktuj" onClick={() => { setQuickOpen(false); onNew("dictate"); }} />}
            <SheetTile Icon={ImagePlus} label="Zdjęcie" onClick={() => { setQuickOpen(false); onNew("image"); }} />
            <SheetTile Icon={PenTool} label="Rysunek" onClick={() => { setQuickOpen(false); onNew("draw"); }} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+16px)] border-t border-border/60">
          <div aria-hidden className="mx-auto -mt-2 mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/25" />
          <SheetHeader className="text-left">
            <SheetTitle className="font-display">Więcej</SheetTitle>
          </SheetHeader>
          <SheetGroup title="Dodaj">
            <SheetTile Icon={Plus} label="Dodaj…" onClick={() => { setMoreOpen(false); setQuickOpen(true); }} />
          </SheetGroup>
          <SheetGroup title="Przejdź do">
            <SheetTile Icon={Archive} label="Archiwum" active={view === "archive"} onClick={() => { onGo("archive"); setMoreOpen(false); }} />
            <SheetTile Icon={Trash2} label="Kosz" active={view === "trash"} badge={trashCount || undefined} onClick={() => { onGo("trash"); setMoreOpen(false); }} />
            <SheetTile Icon={CalendarRange} label="Kalendarz" active={view === "calendar"} onClick={() => { onGo("calendar"); setMoreOpen(false); }} />
            <SheetTile Icon={BriefcaseBusiness} label="Grafik" active={view === "shifts"} onClick={() => { onGo("shifts"); setMoreOpen(false); }} />
            <SheetTile Icon={GraduationCap} label="Nauka" active={view === "study"} onClick={() => { onGo("study"); setMoreOpen(false); }} />
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
            {onOpenActions && <SheetTile Icon={History} label="Ostatnie akcje" onClick={() => { onOpenActions(); setMoreOpen(false); }} />}
            <SheetTile Icon={HelpCircle} label="Samouczek" onClick={() => { window.dispatchEvent(new CustomEvent("kaczy:tour")); setMoreOpen(false); }} />
            {onToggleTheme && <SheetTile Icon={dark ? Sun : Moon} label={dark ? "Tryb jasny" : "Tryb ciemny"} onClick={() => { onToggleTheme(); setMoreOpen(false); }} />}
            {onImport && (
              <ImportExportMenu onImport={onImport} onDone={() => setMoreOpen(false)} align="start">
                <SheetTile Icon={FileDown} label="Import i eksport" />
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
          "pressable relative w-full flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl text-2xs font-display outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "text-primary-ink font-semibold" : "text-muted-foreground font-medium hover:text-foreground"
        )}
      >
        {active && (
          <motion.span
            layoutId="bottom-nav-active"
            className="absolute inset-x-3 top-1 h-8 rounded-xl bg-primary/15"
            transition={spring.snap}
          />
        )}
        <span className="relative z-10">{children}</span>
        {/* Bez ucinania: „Przypomnienia” jest o kilka px szersze niż kolumna, ale obok są wąskie „Więcej” i FAB bez podpisu. */}
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
      <h3 className="px-1 pb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-3 gap-3">{children}</div>
    </section>
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
        "pressable relative flex flex-col items-center gap-1.5 p-3 rounded-2xl border outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
