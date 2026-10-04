import { useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { StickyNote, CalendarDays, Plus, MoreHorizontal, Archive, Trash2, Settings as SettingsIcon, Bell, HelpCircle, History, CalendarRange, Moon, Sun } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { InstallAppButton } from "@/components/InstallAppButton";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

import type { View } from "@/hooks/useFilteredNotes";

interface BottomNavProps {
  view: View;
  onGo: (v: View) => void;
  onNew: () => void;
  onOpenSettings: () => void;
  onOpenActions?: () => void;
  trashCount?: number;
  dark?: boolean;
  onToggleTheme?: () => void;
}

const slots = [
  { key: "notes" as View, label: "Notatki", Icon: StickyNote },
  { key: "today" as View, label: "Dziś", Icon: CalendarDays },
] as const;

const slotsRight = [
  { key: "reminders" as View, label: "Przypomnienia", Icon: Bell },
] as const;

export function BottomNav({ view, onGo, onNew, onOpenSettings, onOpenActions, trashCount = 0, dark = false, onToggleTheme }: BottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = ["archive", "trash", "calendar", "folder", "label"].includes(view);

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
                whileTap={{ scale: 0.92 }}
                transition={spring.snap}
                onClick={onNew}
                aria-label="Nowa notatka"
                className="relative w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-glow-primary ring-4 ring-background"
              >
                <Plus className="w-6 h-6 relative z-10" />
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

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+16px)] border-t border-border/60">
          <div aria-hidden className="mx-auto -mt-2 mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/25" />
          <SheetHeader className="text-left">
            <SheetTitle className="font-display">Więcej</SheetTitle>
          </SheetHeader>
          <SheetGroup title="Przejdź do">
            <SheetTile Icon={Archive} label="Archiwum" active={view === "archive"} onClick={() => { onGo("archive"); setMoreOpen(false); }} />
            <SheetTile Icon={Trash2} label="Kosz" active={view === "trash"} badge={trashCount || undefined} onClick={() => { onGo("trash"); setMoreOpen(false); }} />
            <SheetTile Icon={CalendarRange} label="Kalendarz" active={view === "calendar"} onClick={() => { onGo("calendar"); setMoreOpen(false); }} />
          </SheetGroup>
          <SheetGroup title="Narzędzia">
            {onOpenActions && <SheetTile Icon={History} label="Ostatnie akcje" onClick={() => { onOpenActions(); setMoreOpen(false); }} />}
            <SheetTile Icon={HelpCircle} label="Samouczek" onClick={() => { window.dispatchEvent(new CustomEvent("kaczy:tour")); setMoreOpen(false); }} />
            {onToggleTheme && <SheetTile Icon={dark ? Sun : Moon} label={dark ? "Tryb jasny" : "Tryb ciemny"} onClick={() => { onToggleTheme(); setMoreOpen(false); }} />}
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
          active ? "text-primary font-semibold" : "text-muted-foreground font-medium hover:text-foreground"
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
        <span className="relative z-10 max-w-full truncate px-0.5 leading-none tracking-tight">{label}</span>
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

function SheetTile({ Icon, label, onClick, badge, active = false }: { Icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; badge?: number; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "pressable relative flex flex-col items-center gap-1.5 p-3 rounded-2xl border outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-primary/10 border-primary/40" : "bg-muted/50 hover:bg-muted border-border/50",
      )}
    >
      <span className="w-10 h-10 rounded-xl bg-background flex items-center justify-center text-primary">
        <Icon className="w-5 h-5" />
      </span>
      <span className="text-xs font-medium font-display text-foreground">{label}</span>
      {badge !== undefined && (
        <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-2xs font-semibold flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}
