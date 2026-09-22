import { useMemo } from "react";
import { useEffectsSettings } from "@/lib/effectsSettings";

/**
 * Ambient seasonal "light motes" — glowing bokeh particles that drift, sway
 * and twinkle in the season's accent hue. Replaces the old emoji leaves.
 *
 * Performance: pure CSS keyframes on `transform`/`opacity` only (compositor
 * thread), no JS ticking, `contain: strict`, and the whole layer is skipped
 * when the effect is off or reduced motion is active.
 */
export function SeasonalBackdrop() {
  const settings = useEffectsSettings();
  const enabled = settings.seasonalTheme && settings.snow;

  const motes = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        i,
        left: (i * 61) % 100,
        delay: -((i * 1.9) % 18),
        duration: 16 + ((i * 2.7) % 12),
        size: 4 + (i % 5) * 3,
        sway: 18 + ((i * 7) % 34),
        hue: i % 3,
      })),
    [],
  );

  if (!enabled) return null;

  return (
    <div
      aria-hidden
      className="seasonal-motes pointer-events-none fixed inset-0 z-[5] overflow-hidden"
    >
      {motes.map((m) => (
        <span
          key={m.i}
          className="seasonal-mote"
          style={{
            left: `${m.left}%`,
            width: m.size,
            height: m.size,
            ["--fall" as string]: `${m.duration}s`,
            animationDelay: `${m.delay}s`,
            ["--sway" as string]: `${m.sway}px`,
            ["--glow" as string]:
              m.hue === 0
                ? "hsl(var(--season-accent))"
                : m.hue === 1
                  ? "hsl(var(--primary))"
                  : "hsl(var(--accent))",
          }}
        />
      ))}
      {/* Slow horizon shimmer that ties the motes to the backdrop */}
      <div className="seasonal-shimmer" />
    </div>
  );
}
