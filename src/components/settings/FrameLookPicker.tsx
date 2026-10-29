import { Check } from "lucide-react";
import { FRAME_COLORS, FRAME_SURFACES, setFrameColor, setFrameSurface, useFrameLook, type FrameColorId, type FrameSurfaceId } from "@/lib/frameLook";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * Kolor krawędzi i tło kart w „Ramkach” (Wygląd). Próbki są w stylu wyboru akcentu: kółka 44 px,
 * wybrane z obwódką i znacznikiem. Tło pokazuje wariant dla bieżącego motywu.
 */
export function Swatches<T extends string>({ label, options, value, onPick, swatchOf }: {
  label: string;
  options: [T, string][];
  value: T;
  onPick: (v: T) => void;
  swatchOf: (v: T) => string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(([id, name]) => {
        const active = id === value;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={name}
            title={name}
            onClick={() => { if (!active) { haptic("selection"); onPick(id); } }}
            className={cn(
              "pressable grid h-11 w-11 place-items-center rounded-full outline-hidden ring-offset-2 ring-offset-background transition-shadow duration-fast",
              "focus-visible:ring-2 focus-visible:ring-ring",
              active && "ring-2 ring-foreground/70",
            )}
          >
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full shadow-sm ring-1 ring-foreground/15" style={{ background: swatchOf(id) }}>
              {active && <Check className="h-4 w-4 text-black/75" strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function FrameLookPicker() {
  const look = useFrameLook();
  const colorOptions = (Object.keys(FRAME_COLORS) as FrameColorId[]).map((id): [FrameColorId, string] => [id, FRAME_COLORS[id].label]);
  const surfaceOptions = (Object.keys(FRAME_SURFACES) as FrameSurfaceId[]).map((id): [FrameSurfaceId, string] => [id, FRAME_SURFACES[id].label]);
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Kolor krawędzi</p>
        <Swatches
          label="Kolor krawędzi"
          options={colorOptions}
          value={look.color}
          onPick={setFrameColor}
          swatchOf={(id) => FRAME_COLORS[id].hex ?? "linear-gradient(135deg, var(--border) 50%, var(--muted-foreground) 50%)"}
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          {look.color === "theme" ? "Krawędzie w kolorze motywu." : `Krawędzie w kolorze: ${FRAME_COLORS[look.color].label.toLowerCase()}. Siła ramek zostaje z ustawienia powyżej.`}
        </p>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Tło kart</p>
        <Swatches
          label="Tło kart"
          options={surfaceOptions}
          value={look.surface}
          onPick={setFrameSurface}
          swatchOf={(id) => FRAME_SURFACES[id].light ?? "var(--card)"}
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          {look.surface === "theme" ? "Tło kart z motywu." : "Delikatny odcień tła kart. W ciemnym motywie zmienia się na ciemniejszy odpowiednik."}
        </p>
      </div>
    </div>
  );
}
