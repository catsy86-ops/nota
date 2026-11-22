import { useState } from "react";
import { Tag, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface LabelPickerProps {
  allLabels: string[];
  selected: string[];
  onToggle: (label: string) => void;
  onCreateLabel: (label: string) => void;
}

export function LabelPicker({ allLabels, selected, onToggle, onCreateLabel }: LabelPickerProps) {
  const [newLabel, setNewLabel] = useState("");
  const [open, setOpen] = useState(false);

  function handleCreate() {
    const trimmed = newLabel.trim();
    if (trimmed && !allLabels.includes(trimmed)) {
      onCreateLabel(trimmed);
      onToggle(trimmed);
    } else if (trimmed && !selected.includes(trimmed)) {
      onToggle(trimmed);
    }
    setNewLabel("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="pressable p-1.5 rounded-full text-muted-foreground hover:bg-foreground/5 transition-colors"
          data-tip="Etykiety"
          data-tip-keys="L"
          aria-label="Etykiety"
        >
          <Tag className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3 space-y-3" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="ui-hint font-semibold font-display">Etykiety</p>
        <div className="flex gap-1 flex-wrap">
          {/* M3.1: pigułki wchodzą z `@starting-style` przy otwarciu i dodaniu; usunięta znika od razu. */}
          {allLabels.map((label) => (
            <div key={label} className="presence-pop">
              <Badge
                variant={selected.includes(label) ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => onToggle(label)}
              >
                {label}
              </Badge>
            </div>
          ))}
        </div>
        {allLabels.length === 0 && (
          <p className="ui-hint">Brak etykiet. Utwórz pierwszą!</p>
        )}
        <div className="flex gap-1.5 items-center">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Nowa etykieta..."
            autoComplete="off"
            className="flex-1 text-xs bg-muted/60 border border-border rounded-field px-2.5 py-1.5 outline-hidden focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground"
          />
          <button
            onClick={handleCreate}
            aria-label="Dodaj etykietę"
            title="Dodaj etykietę"
            className="pressable p-1.5 rounded-field bg-primary text-primary-foreground coarse:min-h-11 coarse:min-w-11"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface LabelBadgesProps {
  labels: string[];
  onRemove?: (label: string) => void;
}

export function LabelBadges({ labels, onRemove }: LabelBadgesProps) {
  if (labels.length === 0) return null;
  // Na kaflu (bez usuwania) etykiety to cichy „#dom” — pigułki zostają dla terminu i priorytetu.
  // „#” z CSS, więc tekst etykiety zostaje taki sam dla czytników i wyszukiwania.
  if (!onRemove) {
    return (
      <div className="flex gap-x-1.5 gap-y-0.5 flex-wrap mt-2 text-2xs font-medium text-muted-foreground">
        {labels.map((label) => <span key={label} className="before:content-['#'] before:opacity-60">{label}</span>)}
      </div>
    );
  }
  return (
    <div className="flex gap-1 flex-wrap mt-2">
      {labels.map((label) => (
        <Badge key={label} variant="secondary" className="text-2xs px-1.5 py-0 gap-1">
          {label}
          {onRemove && (
            <button onClick={(e) => { e.stopPropagation(); onRemove(label); }}>
              <X className="size-2.5" />
            </button>
          )}
        </Badge>
      ))}
    </div>
  );
}
