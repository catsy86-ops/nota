import { useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { StickyNote, CalendarDays, Plus, MoreHorizontal, Archive, Trash2, Settings as SettingsIcon, Bell, HelpCircle, History } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { InstallAppButton } from "@/components/InstallAppButton";
import { cn } from "@/lib/utils";

type View = "notes" | "today" | "week" | "archive" | "label" | "reminders" | "folder" | "widget" | "trash";

interface BottomNavProps {
  view: View;
  onGo: (v: View) => void;
  onNew: () => void;
  onOpenSettings: () => void;
  onOpenActions?: () => void;
  trashCount?: number;
  archiveCount?: number;
}

const slots = [
  { key: "notes" as View, label: "Notatki", Icon: StickyNote },
  { key: "today" as View, label: "Dziś", Icon: CalendarDays },
] as const;

const slotsRight = [
  { key: "archive" as View, label: "Archiwum", Icon: Archive },
] as const;

export function BottomNav({ view, onGo, onNew, onOpenSettings, onOpenActions, trashCount = 0, archiveCount = 0 }: BottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = ["trash", "reminders", "folder", "label"].includes(view);

  return (
    <>
      <motion.nav
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="fixed bottom-0 inset-x-0 z-40 md:hidden glass-strong border-t border-border/60 pb-[env(safe-area-inset-bottom)]"
        style={{ boxShadow: "0 -8px 24px -12px hsl(var(--foreground) / 0.15)" }}
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
                whileHover={{ scale: 1.06, rotate: 6 }}
                whileTap={{ scale: 0.9, rotate: -4 }}
                transition={{ type: "spring", stiffness: 380, damping: 18 }}
                onClick={onNew}
                aria-label="Nowa notatka"
                className="relative w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-[0_10px_28px_-8px_hsl(var(--primary)/0.55)] ring-4 ring-background"
              >
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-primary/40"
                  animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                />
                <Plus className="w-6 h-6 relative z-10" />
              </motion.button>
            </li>

            {slotsRight.map(({ key, label, Icon }) => (
              <NavItem key={key} active={view === key} label={label} onClick={() => onGo(key)} badge={key === "archive" ? archiveCount : undefined}>
                <Icon className="w-5 h-5" />
              </NavItem>
            ))}

            <NavItem active={isMoreActive || moreOpen} label="Więcej" onClick={() => setMoreOpen(true)}>
              <MoreHorizontal className="w-5 h-5" />
            </NavItem>
          </ul>
        </LayoutGroup>
      </motion.nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+16px)] border-t border-border/60">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display">Więcej</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 pt-4">
            <InstallAppButton variant="tile" onDone={() => setMoreOpen(false)} />
            {onOpenActions && <SheetTile Icon={History} label="Ostatnie akcje" onClick={() => { onOpenActions(); setMoreOpen(false); }} />}
            <SheetTile Icon={HelpCircle} label="Samouczek" onClick={() => { window.dispatchEvent(new CustomEvent("kaczy:tour")); setMoreOpen(false); }} />
            <SheetTile Icon={Trash2} label="Kosz" badge={trashCount || undefined} onClick={() => { onGo("trash"); setMoreOpen(false); }} />
            <SheetTile Icon={Bell} label="Przypomnienia" onClick={() => { onGo("reminders"); setMoreOpen(false); }} />
            <SheetTile Icon={SettingsIcon} label="Ustawienia" onClick={() => { onOpenSettings(); setMoreOpen(false); }} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function NavItem({ active, label, onClick, children, badge }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode; badge?: number }) {
  return (
    <li className="relative">
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={onClick}
        className={cn(
          "relative w-full flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl text-[10px] font-medium font-display transition-colors",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {active && (
          <motion.span
            layoutId="bottom-nav-active"
            className="absolute inset-x-3 top-1 h-8 rounded-xl bg-primary/10"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
        <span className="relative z-10">{children}</span>
        <span className="relative z-10 leading-none">{label}</span>
        {!!badge && (
          <span className="absolute top-0.5 right-1/4 min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-semibold flex items-center justify-center z-10">
            {badge}
          </span>
        )}
      </motion.button>
    </li>
  );
}

function SheetTile({ Icon, label, onClick, badge }: { Icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; badge?: number }) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="relative flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-muted/50 hover:bg-muted transition-colors border border-border/50"
    >
      <span className="w-10 h-10 rounded-xl bg-background flex items-center justify-center text-primary">
        <Icon className="w-5 h-5" />
      </span>
      <span className="text-xs font-medium font-display text-foreground">{label}</span>
      {badge !== undefined && (
        <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
          {badge}
        </span>
      )}
    </motion.button>
  );
}
