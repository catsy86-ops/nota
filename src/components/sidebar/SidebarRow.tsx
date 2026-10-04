import { forwardRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Jeden wiersz paska bocznego: nawigacja, etykiety, foldery i stopka.
// Jeden stan aktywny — pomarańczowa pigułka (wspólny `layoutId`, więc przejeżdża
// między widokiem, etykietą i folderem). Klikalna część to prawdziwy `<button>`,
// akcje są jego rodzeństwem (bez przycisków w przycisku) i pokazują się przy
// najechaniu albo fokusie klawiatury w wierszu.

interface SidebarRowProps {
  icon?: React.ReactNode;
  label: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  /** Notatka przeciągana nad wierszem. */
  dropActive?: boolean;
  /** W przycisku, za etykietą: licznik, skrót, strzałka. */
  trailing?: React.ReactNode;
  /** Przed przyciskiem, np. zwijanie podfolderów. */
  before?: React.ReactNode;
  /** Osobne przyciski na końcu wiersza. */
  actions?: React.ReactNode;
  className?: string;
  buttonProps?: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "className" | "children">;
}

export const SidebarRow = forwardRef<HTMLDivElement, SidebarRowProps>(function SidebarRow(
  { icon, label, onClick, active = false, dropActive = false, trailing, before, actions, className, buttonProps },
  ref,
) {
  return (
    <div
      ref={ref}
      data-active={active || undefined}
      className={cn(
        "group relative flex items-center h-9 coarse:h-11 rounded-lg text-sm font-medium transition-[color,background-color,box-shadow] duration-[var(--dur-fast)]",
        active ? "text-primary" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
        dropActive && "bg-primary/10 text-primary ring-2 ring-primary/40",
        className,
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active-pill"
          aria-hidden
          className="absolute inset-0 rounded-lg bg-primary/10"
          transition={spring.snap}
        />
      )}
      {before && <span className="relative z-10 flex shrink-0 items-center pl-1.5">{before}</span>}
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        {...buttonProps}
        className={cn(
          "pressable relative z-10 flex h-full min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
          before ? "pl-1.5 pr-3" : "px-3",
        )}
      >
        {icon && <span className="flex w-[18px] shrink-0 items-center justify-center">{icon}</span>}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {trailing}
      </button>
      {actions && (
        <div
          className={cn(
            // Ukryte akcje nie zabierają miejsca nazwie — pojawiają się przy najechaniu,
            // fokusie klawiatury w wierszu albo otwartym menu.
            "relative z-10 hidden shrink-0 items-center pr-1",
            "group-hover:flex group-focus-within:flex has-[[data-state=open]]:flex",
            // Na dotyku nie ma najechania — akcje widać przy aktywnym wierszu.
            "coarse:group-data-[active]:flex",
          )}
        >
          {actions}
        </div>
      )}
    </div>
  );
});

/** Menu „⋯” z akcjami wiersza (nazwa, kolor, usuń…). */
export function SidebarRowMenu({ label, children, onCloseAutoFocus }: {
  /** Nazwa elementu, np. „folderu Praca” — trafia do etykiety przycisku. */
  label: string;
  children: React.ReactNode;
  onCloseAutoFocus?: (e: Event) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Akcje ${label}`}
          onClick={(e) => e.stopPropagation()}
          className="pressable grid h-7 w-7 coarse:h-9 coarse:w-9 place-items-center rounded-md outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-foreground/10"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" onCloseAutoFocus={onCloseAutoFocus}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Licznik przy pozycji nawigacji. */
export function SidebarCount({ value, active }: { value: number; active?: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 min-w-[22px] rounded-full px-2 py-0.5 text-center text-2xs font-semibold tabular-nums",
        active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {value}
    </span>
  );
}
