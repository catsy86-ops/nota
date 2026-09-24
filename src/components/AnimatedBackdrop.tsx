import { useMotionPref } from "@/hooks/useMotionPref";

/**
 * "Aurora" mesh-gradient backdrop — three big, saturated color blooms in the
 * app's own primary/accent hues, drifting slowly and cycling hue for a
 * vivid, ever-shifting gradient wash.
 *
 * Performance notes:
 * - No JS: no scroll listener, no rAF loop, no per-frame style writes.
 * - Blob drift animates `transform` only (compositor thread), no `filter`.
 * - The hue cycle is a single `filter: hue-rotate()` on one dedicated,
 *   `contain: strict` layer — one composited layer, not per-blob.
 * - Fully static in reduced-motion mode.
 */
export function AnimatedBackdrop() {
  const { reduced } = useMotionPref();
  const animated = !reduced;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
      style={{ contain: "strict" }}
    >
      <div className={animated ? "backdrop-aurora backdrop-aurora-animated" : "backdrop-aurora"}>
        <div className="backdrop-bloom backdrop-bloom-1" style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.55), transparent 70%)" }} />
        <div className="backdrop-bloom backdrop-bloom-2" style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.5), transparent 70%)" }} />
        <div className="backdrop-bloom backdrop-bloom-3" style={{ background: "radial-gradient(closest-side, hsl(var(--season-accent, var(--accent)) / 0.4), transparent 70%)" }} />
      </div>
    </div>
  );
}
