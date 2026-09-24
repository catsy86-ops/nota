import { useState } from "react";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseNaturalDate } from "@/lib/parseNaturalDate";

interface QuickReminderInputProps {
  onParsed: (date: Date) => void;
}

export function QuickReminderInput({ onParsed }: QuickReminderInputProps) {
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
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleParse();
            }
          }}
          placeholder="np. jutro 15:00, za 2h"
          className={cn(
            "flex-1 text-xs bg-muted/60 border rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground/70",
            error ? "border-destructive" : "border-border"
          )}
        />
        <Button size="sm" variant="outline" className="px-2" onClick={handleParse} title="Rozpoznaj datę">
          <Wand2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      {error && (
        <p className="text-[10px] text-destructive">Nie rozpoznano daty. Spróbuj np. "jutro 15:00" lub "za 2h".</p>
      )}
    </div>
  );
}
