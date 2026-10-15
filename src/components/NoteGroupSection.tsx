import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface NoteGroupSectionProps {
  /** Klucz do testów i `aria-controls`. */
  groupKey: string;
  label: ReactNode;
  count: number;
  /** Czy nagłówek jest przyciskiem zwijającym sekcję. */
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  /** Nagłówek w kolorze ostrzegawczym (np. zaległe). */
  tone?: "default" | "alert";
  children: ReactNode;
}

/**
 * Sekcja siatki z nagłówkiem „jak w zeszycie”: wersaliki, licznik i cienka
 * kreska do prawej krawędzi. Zwinięta sekcja nie renderuje siatki — tym samym
 * wyrejestrowuje się z nawigacji klawiaturą (patrz `registerGridNavSection`).
 */
export function NoteGroupSection({ groupKey, label, count, collapsible, collapsed, onToggle, tone = "default", children }: NoteGroupSectionProps) {
  const bodyId = `group-body-${groupKey}`;
  const text = (
    <>
      {collapsible && (
        <ChevronDown
          className={cn("w-3.5 h-3.5 shrink-0 transition-transform duration-fast", collapsed && "-rotate-90")}
          aria-hidden
        />
      )}
      <span className="truncate">{label}</span>
      <span className="bg-muted text-foreground/80 text-2xs px-1.5 rounded-full tabular-nums normal-case tracking-normal">{count}</span>
      <span className="flex-1 h-px bg-border/70 ml-1" aria-hidden />
    </>
  );
  const headerClass = cn(
    "w-full text-xs font-semibold uppercase tracking-wider mb-3 px-1 flex items-center gap-1.5",
    tone === "alert" ? "text-destructive" : "text-muted-foreground",
  );
  return (
    <section data-group={groupKey} aria-label={typeof label === "string" ? label : undefined}>
      {collapsible ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          data-group-toggle={groupKey}
          className={cn(headerClass, "text-left rounded-md hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors duration-fast", collapsed && "mb-0")}
        >
          {text}
        </button>
      ) : (
        <p className={headerClass}>{text}</p>
      )}
      {!collapsed && <div id={bodyId}>{children}</div>}
    </section>
  );
}
