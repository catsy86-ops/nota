import { useState } from "react";
import { Link2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cleanAliases } from "@/lib/wikiLinks";

interface AliasPickerProps {
  /** Tytuł notatki — alias równy tytułowi nic by nie dał, więc go odrzucamy. */
  title: string;
  aliases: string[];
  onSave: (aliases: string[]) => void;
}

/**
 * Aliasy notatki: inne nazwy, pod którymi `[[nazwa]]` ją znajduje. Przycisk i popover
 * jak przy etykietach; zapis dopiero po „Zapisz”, żeby nie zmieniać linków w połowie pisania.
 */
export function AliasPicker({ title, aliases, onSave }: AliasPickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  function handleOpenChange(next: boolean) {
    if (next) setDraft(aliases.join(", "));
    setOpen(next);
  }

  function handleSave() {
    onSave(cleanAliases(draft.split(","), title));
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="pressable p-1.5 rounded-full text-muted-foreground hover:bg-foreground/5 transition-colors"
          title="Aliasy"
          aria-label="Aliasy"
        >
          <Link2 className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-3" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-semibold font-display text-muted-foreground uppercase tracking-wider">Aliasy</p>
        <p className="text-xs text-muted-foreground">
          Inne nazwy tej notatki, oddzielone przecinkami. Link [[nazwa]] pod każdą z nich prowadzi tutaj.
        </p>
        <label htmlFor="alias-input" className="sr-only">Aliasy notatki</label>
        <Input
          id="alias-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } }}
          placeholder="łazienka, PL"
          spellCheck={false}
          autoComplete="off"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            className="pressable px-3 py-1.5 rounded-control text-sm font-medium bg-primary text-primary-foreground"
          >
            Zapisz aliasy
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
