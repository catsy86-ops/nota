import { Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { COVER_LABELS, COVER_STYLES, NOTE_COVERS, NOTE_ICONS, type NoteCover } from "@/lib/noteLook";

interface NoteLookPickerProps {
  icon?: string;
  cover?: NoteCover;
  onChange: (patch: { icon?: string; cover?: NoteCover }) => void;
}

/** Ikona i okładka notatki: siatka emoji + gotowe wzory. Pusty wybór zdejmuje ozdobę. */
export function NoteLookPicker({ icon, cover, onChange }: NoteLookPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="Ikona i okładka"
          data-tip="Ikona i okładka"
          className={cn("card-action", icon || cover ? "text-primary" : "text-muted-foreground")}
        >
          {icon ? <span className="text-base leading-none" aria-hidden>{icon}</span> : <Smile className="w-4 h-4" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-3" align="start" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="flex items-center justify-between pb-1.5">
            <p className="text-xs font-semibold font-display text-muted-foreground uppercase tracking-wider">Ikona</p>
            {icon && (
              <button type="button" onClick={() => onChange({ icon: undefined })} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                Usuń
              </button>
            )}
          </div>
          <div className="grid grid-cols-8 gap-0.5">
            {NOTE_ICONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onChange({ icon: e })}
                aria-pressed={icon === e}
                aria-label={`Ustaw ikonę: ${e}`}
                className={cn(
                  "pressable w-7 h-7 coarse:w-9 coarse:h-9 rounded-md text-sm flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  icon === e ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/80",
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between pb-1.5">
            <p className="text-xs font-semibold font-display text-muted-foreground uppercase tracking-wider">Okładka</p>
            {cover && (
              <button type="button" onClick={() => onChange({ cover: undefined })} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                Usuń
              </button>
            )}
          </div>
          <div className="flex gap-1.5">
            {NOTE_COVERS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange({ cover: c })}
                aria-pressed={cover === c}
                aria-label={`Okładka: ${COVER_LABELS[c]}`}
                title={COVER_LABELS[c]}
                style={COVER_STYLES[c]}
                className={cn(
                  "pressable h-8 flex-1 rounded-md border-2 transition-colors",
                  cover === c ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-muted-foreground/30",
                )}
              />
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Pasek okładki nad treścią kafla (na pełną szerokość, wyrównany do krawędzi karty). */
export function NoteCoverStrip({ cover, className }: { cover?: NoteCover; className?: string }) {
  if (!cover) return null;
  return <div aria-hidden style={COVER_STYLES[cover]} className={cn("h-10 w-full", className)} />;
}
