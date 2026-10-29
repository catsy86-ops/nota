import { useState } from "react";
import { WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseNaturalDate } from "@/lib/parseNaturalDate";

interface QuickReminderInputProps {
  onParsed: (date: Date) => void;
  /** Podgląd na żywo (F2.3): rozpoznana data ustawia pola, ale niczego nie zapisuje. */
  onPreview?: (date: Date) => void;
}

export function QuickReminderInput({ onParsed, onPreview }: QuickReminderInputProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState(false);

  function handleParse() {
    const parsed = parseNaturalDate(text);
    if (!parsed) {
      setError(true);
      return;
    }
    setError(false);
    onParsed(parsed);
    setText("");
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(false);
            const parsed = e.target.value.trim() ? parseNaturalDate(e.target.value) : null;
            if (parsed) onPreview?.(parsed);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleParse();
            }
          }}
          placeholder="np. jutro 15:00, za 2h"
          className={cn(
            "flex-1 text-xs bg-muted/60 border rounded-field px-2 py-1.5 outline-hidden focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground/70",
            error ? "border-destructive" : "border-border"
          )}
        />
        <Button size="sm" variant="outline" className="px-2" onClick={handleParse} title="Rozpoznaj datę">
          <WandSparkles className="w-3.5 h-3.5" />
        </Button>
      </div>
      {error && (
        <p className="text-2xs text-destructive-ink">Nie rozpoznano daty. Spróbuj np. "jutro 15:00" lub "za 2h".</p>
      )}
    </div>
  );
}
