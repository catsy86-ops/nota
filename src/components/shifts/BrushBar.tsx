import { Eraser, MousePointerClick, Pencil, Plus, Repeat } from "lucide-react";
import type { ShiftType } from "@/lib/shifts";
import { cn } from "@/lib/utils";

/** Co robi stuknięcie w dzień: nanosi zmianę, czyści dzień albo otwiera jego szczegóły. */
export type Brush = { kind: "type"; id: string } | { kind: "erase" } | { kind: "inspect" };

interface BrushBarProps {
  types: ShiftType[];
  brush: Brush;
  onBrush: (b: Brush) => void;
  onEditType: (t: ShiftType) => void;
  onAddType: () => void;
  onPattern: () => void;
}

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function BrushBar({ types, brush, onBrush, onEditType, onAddType, onPattern }: BrushBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto py-1.5 -mx-4 px-4 sm:-mx-1 sm:px-1">
      <div role="radiogroup" aria-label="Zmiana do naniesienia" className="flex shrink-0 gap-2">
        {types.map((t) => (
          <BrushChip key={t.id} type={t} active={brush.kind === "type" && brush.id === t.id}
            onClick={() => onBrush({ kind: "type", id: t.id })} onEdit={() => onEditType(t)} />
        ))}
        <ToolButton active={brush.kind === "erase"} onClick={() => onBrush({ kind: "erase" })} Icon={Eraser} label="Wolne" />
        <ToolButton active={brush.kind === "inspect"} onClick={() => onBrush({ kind: "inspect" })} Icon={MousePointerClick} label="Szczegóły" />
      </div>
      <span aria-hidden className="w-px shrink-0 bg-border/70 my-2" />
      <button type="button" onClick={onPattern}
        className={cn("pressable shrink-0 flex items-center gap-1.5 px-3 h-12 rounded-2xl border border-border/60 bg-card/50 hover:bg-muted text-sm font-medium font-display", focusRing)}>
        <Repeat className="w-4 h-4" /> Cykl
      </button>
      <button type="button" onClick={onAddType} aria-label="Dodaj rodzaj zmiany"
        className={cn("pressable shrink-0 w-12 h-12 rounded-2xl border border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted", focusRing)}>
        <Plus className="w-5 h-5" />
      </button>
    </div>
  );
}

function ToolButton({ active, onClick, Icon, label }: { active: boolean; onClick: () => void; Icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onClick}
      className={cn("pressable shrink-0 flex items-center gap-1.5 px-3 h-12 rounded-2xl border text-sm font-medium font-display", focusRing,
        active ? "border-foreground/50 bg-muted" : "border-border/60 bg-card/50 hover:bg-muted")}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

function BrushChip({ type, active, onClick, onEdit }: { type: ShiftType; active: boolean; onClick: () => void; onEdit: () => void }) {
  const absence = type.kind === "absence";
  return (
    <div className={cn("shrink-0 flex items-center rounded-2xl border transition-colors",
      active ? "border-transparent ring-2 ring-offset-2 ring-offset-background" : "border-border/60 bg-card/50")}
      style={active ? { backgroundColor: `${type.color}22`, ["--tw-ring-color" as string]: type.color } : undefined}>
      <button type="button" role="radio" aria-checked={active} onClick={onClick}
        className={cn("pressable flex items-center gap-2 pl-1.5 pr-2 h-12 rounded-l-2xl", focusRing)}>
        <span className={cn("w-9 h-9 rounded-xl flex items-center justify-center font-display font-bold",
          absence ? "border-2 bg-transparent" : "text-white")}
          style={absence ? { borderColor: type.color, color: type.color } : { backgroundColor: type.color }}>
          {type.short}
        </span>
        <span className="text-left leading-tight">
          <span className="block text-sm font-semibold font-display">{type.name}</span>
          <span className="block text-2xs text-muted-foreground tabular-nums">{absence ? "nieobecność" : `${type.start}–${type.end}`}</span>
        </span>
      </button>
      <button type="button" onClick={onEdit} aria-label={`Edytuj zmianę ${type.name}`}
        className={cn("pressable h-12 px-2 coarse:px-3.5 rounded-r-2xl text-muted-foreground hover:text-foreground hover:bg-foreground/5", focusRing)}>
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
