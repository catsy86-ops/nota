import { FaceSlightlySmiling } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { COVER_LABELS, COVER_STYLES, NOTE_COVERS, NOTE_ICONS, type NoteCover } from "@/lib/noteLook";
import { Button } from "@/components/ui/button";

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
          className={cn("card-action", icon || cover ? "text-primary-ink" : "text-muted-foreground")}
        >
          {icon ? <span className="text-base leading-none" aria-hidden>{icon}</span> : <FaceSlightlySmiling className="size-4" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-3" align="start" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="flex items-center justify-between pb-1.5">
            <p className="ui-hint font-semibold font-display">Ikona</p>
            {icon && (
              <Button type="button" variant="link" size="sm" onClick={() => onChange({ icon: undefined })} className="h-auto p-0 text-xs font-normal text-muted-foreground underline hover:text-foreground coarse:min-h-11">
                Usuń
              </Button>
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
                  "pressable size-7 coarse:w-9 coarse:h-9 rounded-control text-sm flex items-center justify-center outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
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
            <p className="ui-hint font-semibold font-display">Okładka</p>
            {cover && (
              <Button type="button" variant="link" size="sm" onClick={() => onChange({ cover: undefined })} className="h-auto p-0 text-xs font-normal text-muted-foreground underline hover:text-foreground coarse:min-h-11">
                Usuń
              </Button>
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
                  "pressable h-8 flex-1 rounded-control border-2 transition-colors",
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
