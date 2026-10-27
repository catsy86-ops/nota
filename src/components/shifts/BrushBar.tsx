import { useEffect, useRef, useState } from "react";
import { Eraser, MousePointerClick, Pencil, Plus, Repeat } from "lucide-react";
import { shiftInk, shiftTextOnCard, type ShiftType } from "@/lib/shifts";
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

const focusRing = "outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

const sameBrush = (a: Brush, b: Brush) => a.kind === b.kind && (a.kind !== "type" || (b.kind === "type" && a.id === b.id));

/**
 * Pasek pędzli. „Cykl” i „+” stoją na początku — na wąskim ekranie pędzle
 * się przewijają, a akcje mają być zawsze w zasięgu. Prawa krawędź zanika,
 * dopóki jest co przewijać. Pędzle to grupa radio wg ARIA: jeden przystanek
 * tabulatora, strzałki wybierają sąsiedni.
 */
export function BrushBar({ types, brush, onBrush, onEditType, onAddType, onPattern }: BrushBarProps) {
  const options: Brush[] = [...types.map((t): Brush => ({ kind: "type", id: t.id })), { kind: "erase" }, { kind: "inspect" }];
  const activeIndex = Math.max(0, options.findIndex((o) => sameBrush(o, brush)));
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const [moreRight, setMoreRight] = useState(false);

  const measure = () => {
    const el = scroller.current;
    if (el) setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [types.length]);
  // Wybrany pędzel zawsze widoczny (np. po dodaniu nowej zmiany na końcu listy).
  // Nie przy wejściu w widok — to przewinęłoby całą stronę.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    radios.current[activeIndex]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeIndex]);

  function onRadioKey(e: React.KeyboardEvent) {
    // Ołówek edycji leży w tej samej grupie wizualnie, ale nie jest pędzlem.
    if ((e.target as HTMLElement).getAttribute("role") !== "radio") return;
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (activeIndex + step + options.length) % options.length;
    onBrush(options[next]);
    radios.current[next]?.focus();
  }

  const radio = (i: number) => ({
    ref: (el: HTMLButtonElement | null) => { radios.current[i] = el; },
    tabIndex: i === activeIndex ? 0 : -1,
  });

  return (
    <div ref={scroller} onScroll={measure}
      className={cn("flex gap-2 overflow-x-auto py-1.5 -mx-4 px-4 sm:-mx-1 sm:px-1 sm:flex-wrap sm:overflow-visible short:flex-nowrap! short:overflow-x-auto!",
        moreRight && "mask-[linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] sm:mask-none short:mask-[linear-gradient(to_right,black_calc(100%-2.5rem),transparent)]!")}>
      <button type="button" onClick={onPattern}
        className={cn("pressable shrink-0 flex items-center gap-1.5 px-3 h-12 rounded-card border border-border/60 bg-card hover:bg-muted text-sm font-medium font-display", focusRing)}>
        <Repeat className="w-4 h-4" /> Cykl
      </button>
      <button type="button" onClick={onAddType} aria-label="Dodaj rodzaj zmiany"
        className={cn("pressable shrink-0 w-12 h-12 rounded-card border border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted", focusRing)}>
        <Plus className="w-5 h-5" />
      </button>
      <span aria-hidden className="w-px shrink-0 bg-border/70 my-2" />
      <div role="radiogroup" aria-label="Zmiana do naniesienia" className="flex shrink-0 gap-2 sm:shrink sm:flex-wrap short:shrink-0! short:flex-nowrap!" onKeyDown={onRadioKey}>
        {types.map((t, i) => (
          <BrushChip key={t.id} type={t} active={activeIndex === i} radio={radio(i)}
            onClick={() => onBrush({ kind: "type", id: t.id })} onEdit={() => onEditType(t)} />
        ))}
        <ToolButton active={brush.kind === "erase"} radio={radio(types.length)} onClick={() => onBrush({ kind: "erase" })} Icon={Eraser} label="Wolne" />
        <ToolButton active={brush.kind === "inspect"} radio={radio(types.length + 1)} onClick={() => onBrush({ kind: "inspect" })} Icon={MousePointerClick} label="Szczegóły" />
      </div>
    </div>
  );
}

interface RadioProps {
  ref: (el: HTMLButtonElement | null) => void;
  tabIndex: number;
}

function ToolButton({ active, radio, onClick, Icon, label }: { active: boolean; radio: RadioProps; onClick: () => void; Icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onClick} ref={radio.ref} tabIndex={radio.tabIndex}
      className={cn("pressable relative shrink-0 flex items-center justify-center gap-1.5 px-3 max-sm:px-0 max-sm:w-12 h-12 rounded-card border text-sm font-medium font-display", focusRing,
        active ? "border-foreground/50 bg-muted" : "border-border/60 bg-card hover:bg-muted")}>
      <Icon className="w-4 h-4" /> <span className="max-sm:sr-only">{label}</span>
    </button>
  );
}

function BrushChip({ type, active, radio, onClick, onEdit }: { type: ShiftType; active: boolean; radio: RadioProps; onClick: () => void; onEdit: () => void }) {
  const absence = type.kind === "absence";
  return (
    <div className={cn("shrink-0 flex items-center rounded-card border transition-colors",
      active ? "border-transparent ring-2 ring-offset-2 ring-offset-background" : "border-border/60 bg-card")}
      style={active ? { backgroundColor: `${type.color}22`, ["--tw-ring-color" as string]: type.color } : undefined}>
      <button type="button" role="radio" aria-checked={active} onClick={onClick} ref={radio.ref} tabIndex={radio.tabIndex}
        className={cn("pressable relative flex items-center gap-2 pl-1.5 pr-2 max-sm:pr-1.5 h-12 rounded-l-2xl", focusRing, !active && "max-sm:rounded-r-2xl")}>
        <span className={cn("w-9 h-9 rounded-card flex items-center justify-center font-display font-bold",
          absence && "border-2 bg-transparent")}
          style={absence ? { borderColor: type.color, color: shiftTextOnCard(type.color) } : { backgroundColor: type.color, color: shiftInk(type.color) }}>
          {type.short}
        </span>
        {/* Na telefonie sam skrót — nazwa i godziny zostają dla czytników. `relative` na przycisku trzyma
            `sr-only` (absolute) w środku przewijanego paska, inaczej poszerzało stronę. */}
        <span className="text-left leading-tight max-sm:sr-only">
          <span className="block text-sm font-semibold font-display">{type.name}</span>
          <span className="block text-2xs text-muted-foreground tabular-nums">{absence ? "nieobecność" : `${type.start}–${type.end}`}</span>
        </span>
      </button>
      <button type="button" onClick={onEdit} aria-label={`Edytuj rodzaj ${type.name}`}
        className={cn("pressable h-12 px-2 coarse:px-[15px] rounded-r-2xl text-muted-foreground hover:text-foreground hover:bg-foreground/5", focusRing, !active && "max-sm:hidden")}>
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
