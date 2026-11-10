import { cn } from "@/lib/utils";

/** H1.3: skąd schodzi materiał wpisu — z auta (domyślnie) albo dostawa na budowę. */
export function EntrySupplyToggle({ supply, onChange }: { supply: "site" | "van"; onChange: (v: "site" | "van") => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-field border border-border p-0.5" role="group" aria-label="Skąd materiał" data-testid="entry-supply">
      {([["van", "Z auta"], ["site", "Dostawa na budowę"]] as const).map(([v, label]) => (
        <button key={v} type="button" aria-pressed={supply === v} onClick={() => onChange(v)}
          className={cn("pressable rounded-[calc(var(--r-field)-2px)] px-2 py-1 text-xs coarse:min-h-11 coarse:text-sm",
            supply === v ? "bg-primary/12 font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>
          {label}
        </button>
      ))}
    </div>
  );
}
