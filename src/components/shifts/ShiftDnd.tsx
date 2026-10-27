import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { dayType, shiftInk, shiftTextOnCard, type DayEntry, type ShiftType, type TransferMode } from "@/lib/shifts";
import { cn } from "@/lib/utils";

/** `ask` — dotyk: palec nie ma Alta, więc o przeniesieniu/skopiowaniu pyta małe menu. */
export type DropMode = TransferMode | "ask";

/** Polecenia na dniach, wspólne dla siatki miesiąca i widoku tygodnia (stabilne referencje). */
export interface DayActions {
  transfer: (from: string, to: string, mode: TransferMode) => void;
  /** Ctrl/⌘+C: wpis dnia do schowka. */
  copyEntry: (key: string) => void;
  /** Ctrl/⌘+V: wkleja schowek na dzień. */
  paste: (key: string) => void;
}

interface ShiftDndProps {
  days: Record<string, DayEntry>;
  typesById: Map<string, ShiftType>;
  onTransfer: (from: string, to: string, mode: DropMode) => void;
  children: ReactNode;
}

/**
 * Przeciąganie zmiany z dnia na dzień. Mysz: przenosi, z Alt/Option kopiuje.
 * Dotyk: przytrzymanie (250 ms) zaczyna przeciąganie, upuszczenie pyta, czy
 * przenieść czy skopiować. Klawiatura ma osobną ścieżkę w siatkach (Shift+strzałki).
 * Wzorzec jak w kalendarzu: własny `DndContext` i `MouseSensor` zamiast
 * `PointerSensor` — ten drugi na dotyku startowałby przed przewijaniem strony.
 */
export function ShiftDnd({ days, typesById, onTransfer, children }: ShiftDndProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );
  const [active, setActive] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const alt = useRef(false);

  // Alt bywa wciśnięty w trakcie przeciągania — nasłuchujemy tylko do upuszczenia.
  useEffect(() => {
    if (!active) return;
    const sync = (e: KeyboardEvent | MouseEvent) => {
      alt.current = e.altKey;
      setCopying(e.altKey);
    };
    window.addEventListener("keydown", sync);
    window.addEventListener("keyup", sync);
    window.addEventListener("mousemove", sync);
    return () => {
      window.removeEventListener("keydown", sync);
      window.removeEventListener("keyup", sync);
      window.removeEventListener("mousemove", sync);
    };
  }, [active]);

  function onDragStart(e: DragStartEvent) {
    const key = e.active.data.current?.key;
    alt.current = !!(e.activatorEvent as MouseEvent).altKey;
    setCopying(alt.current);
    setActive(typeof key === "string" ? key : null);
  }

  function onDragEnd(e: DragEndEvent) {
    const from = e.active.data.current?.key;
    const to = e.over?.data.current?.key;
    const touch = "touches" in e.activatorEvent;
    setActive(null);
    if (typeof from !== "string" || typeof to !== "string" || from === to) return;
    onTransfer(from, to, touch ? "ask" : alt.current ? "copy" : "move");
  }

  const entry = active ? days[active] : undefined;
  const base = entry && typesById.get(entry.type);
  const type = base && dayType(base, entry);

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
      {children}
      <DragOverlay dropAnimation={null}>
        {type && (
          <span
            aria-hidden
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-display font-bold text-sm shadow-lg ring-2 ring-primary/50"
            style={type.kind === "absence"
              ? { backgroundColor: `color-mix(in srgb, ${type.color} 30%, var(--card))`, color: shiftTextOnCard(type.color) }
              : { backgroundColor: type.color, color: shiftInk(type.color) }}
          >
            {type.short}
            <span className="text-2xs font-medium opacity-90">{copying ? "+ kopia" : "przenieś"}</span>
          </span>
        )}
      </DragOverlay>
    </DndContext>
  );
}

interface DayDropCellProps {
  dayKey: string;
  /** Dzień ze zmianą da się chwycić; pusty jest tylko celem. */
  draggable: boolean;
  className?: string;
  children: (slot: {
    dragRef: (el: HTMLElement | null) => void;
    dragProps: ReturnType<typeof useDraggable>["listeners"];
    dragging: boolean;
    over: boolean;
  }) => ReactNode;
}

/** `gridcell` dnia: cel upuszczenia, a przycisk w środku (render-prop) jest uchwytem. */
export function DayDropCell({ dayKey, draggable, className, children }: DayDropCellProps) {
  const drop = useDroppable({ id: `shift-drop-${dayKey}`, data: { key: dayKey } });
  const drag = useDraggable({ id: `shift-drag-${dayKey}`, data: { key: dayKey }, disabled: !draggable });
  return (
    <div ref={drop.setNodeRef} role="gridcell" className={cn("flex", className)}>
      {children({ dragRef: drag.setNodeRef, dragProps: drag.listeners, dragging: drag.isDragging, over: drop.isOver })}
    </div>
  );
}
