import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { columnDropId } from "@/lib/boardColumns";

/** Szerokość kolumny — wspólna dla kolumny i przyklejonego paska nagłówków (`NoteBoard`). */
export const BOARD_COLUMN_WIDTH = "w-70 sm:w-72";

/** Etykieta kolumny z licznikiem — w kolumnie i w przyklejonym pasku nagłówków. */
export function BoardColumnHeading({ label, count, className }: { label: ReactNode; count: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground", className)}>
      <span className="truncate">{label}</span>
      <span className="bg-muted text-foreground/80 text-2xs px-1.5 rounded-full tabular-nums normal-case tracking-normal">{count}</span>
    </div>
  );
}

interface BoardColumnProps {
  /** Klucz kolumny — ten sam, który rozpoznaje `useNoteDnd`. */
  columnKey: string;
  label: ReactNode;
  count: number;
  /** Czy upuszczenie karty zmienia coś w notatce (kolumny wg daty tylko pokazują). */
  droppable?: boolean;
  children: ReactNode;
}

/**
 * Kolumna tablicy: nagłówek „jak w zeszycie” i pasek kart. Cała kolumna jest strefą
 * upuszczania, więc kartę można położyć także w pustym miejscu pod ostatnią notatką.
 */
export function BoardColumn({ columnKey, label, count, droppable = true, children }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDropId(columnKey), disabled: !droppable });
  return (
    <section
      ref={setNodeRef}
      data-board-column={columnKey}
      aria-label={typeof label === "string" ? label : undefined}
      className={cn(
        BOARD_COLUMN_WIDTH,
        "shrink-0 snap-start rounded-card border border-border/60 bg-muted/30 p-2.5 transition-colors duration-fast",
        isOver && "border-primary/50 bg-primary/5",
      )}
    >
      <header>
        <BoardColumnHeading label={label} count={count} className="px-1 pb-2.5" />
      </header>
      <div className="min-h-16">{children}</div>
    </section>
  );
}
