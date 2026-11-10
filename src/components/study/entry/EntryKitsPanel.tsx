import { kitSummary, type Kit } from "@/lib/study/kits";

/** H1.2: pigułki zestawów materiału pod „+ Zestaw”; edycja zestawów w osobnym oknie. */
export function EntryKitsPanel({ kits, onAdd, onEdit }: { kits: readonly Kit[]; onAdd: (kit: Kit) => void; onEdit: () => void }) {
  return (
    <div id="journal-kits" className="space-y-2 rounded-card border border-border p-3" data-testid="journal-kits">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Zestawy materiału">
        {kits.map((kit) => (
          <button
            key={kit.id}
            type="button"
            onClick={() => onAdd(kit)}
            aria-label={`${kit.name}: ${kitSummary(kit)}`}
            className="pressable flex flex-col items-start rounded-card bg-muted px-3 py-1.5 text-left hover:bg-primary/10 coarse:min-h-11"
          >
            <span className="text-sm">{kit.name}</span>
            <span className="text-2xs text-muted-foreground">{kitSummary(kit)}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={onEdit} className="pressable text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline coarse:min-h-11">
        {kits.length > 0 ? "Zmień zestawy" : "Dodaj zestaw"}
      </button>
    </div>
  );
}
