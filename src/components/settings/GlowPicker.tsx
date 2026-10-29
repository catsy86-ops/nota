import { CircleOff, Sparkles, Waves, Zap } from "lucide-react";
import { GLOW_COLORS, GLOW_STRENGTH, setGlowColor, setGlowStrength, useGlowLook, type GlowColorId, type GlowStrength } from "@/lib/glowLook";
import { Segmented } from "./Segmented";
import { Swatches } from "./FrameLookPicker";

const strengthOptions: { value: GlowStrength; label: string; Icon: typeof Sparkles }[] = [
  { value: "off", label: GLOW_STRENGTH.off.label, Icon: CircleOff },
  { value: "soft", label: GLOW_STRENGTH.soft.label, Icon: Waves },
  { value: "normal", label: GLOW_STRENGTH.normal.label, Icon: Sparkles },
  { value: "strong", label: GLOW_STRENGTH.strong.label, Icon: Zap },
];

/**
 * Poświata w Wyglądzie: siła i barwa. Podgląd to prawdziwe elementy z klasami aplikacji, więc pokazuje
 * dokładnie to, co dostanie zaznaczona notatka i przycisk „+”.
 */
export function GlowPicker() {
  const look = useGlowLook();
  const colorOptions = (Object.keys(GLOW_COLORS) as GlowColorId[]).map((id): [GlowColorId, string] => [id, GLOW_COLORS[id].label]);
  return (
    <div className="space-y-4">
      <Segmented label="Siła poświaty" options={strengthOptions} value={look.strength} onChange={setGlowStrength} />
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Barwa poświaty</p>
        <Swatches
          label="Barwa poświaty"
          options={colorOptions}
          value={look.color}
          onPick={setGlowColor}
          swatchOf={(id) => GLOW_COLORS[id].hex ?? "linear-gradient(135deg, var(--primary) 50%, var(--season-accent) 50%)"}
        />
      </div>
      <div className="flex flex-wrap items-center gap-6 rounded-card border border-border/60 bg-muted/30 p-4" aria-label="Podgląd poświaty" role="group">
        <div className="note-glow-active relative w-40 rounded-card border border-transparent bg-card p-3 text-sm text-card-foreground">
          Zaznaczona notatka
        </div>
        <span aria-hidden className="shadow-glow-primary inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">
          Zapisz
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {look.strength === "off"
          ? "Bez poświaty. Zaznaczona notatka zostaje obwiedziona, ale bez rozmytego blasku."
          : `${GLOW_STRENGTH[look.strength].label} poświata${look.color === "theme" ? ", w kolorze motywu" : `, w kolorze: ${GLOW_COLORS[look.color].label.toLowerCase()}`}.`}
      </p>
    </div>
  );
}
