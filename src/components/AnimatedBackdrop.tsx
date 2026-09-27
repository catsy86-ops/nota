import { useMotionPref } from "@/hooks/useMotionPref";

/**
 * "Aurora" mesh-gradient backdrop — three big, saturated color blooms in the
 * app's own primary/accent hues. Static and muted by default so it never
 * competes with notes; drift + hue cycle only when motion is set to "Pełne".
 *
 * Performance notes:
 * - No JS: no scroll listener, no rAF loop, no per-frame style writes.
 * - Blob drift animates `transform` only (compositor thread), no `filter`.
 * - The hue cycle is a single `filter: hue-rotate()` on one dedicated,
 *   `contain: strict` layer — one composited layer, not per-blob.
 * - Static unless the user explicitly picks full motion.
 */
export function AnimatedBackdrop() {
  const { mode, reduced } = useMotionPref();
  const animated = mode === "full" && !reduced;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
      style={{ contain: "strict" }}
    >
      <div className={animated ? "backdrop-aurora backdrop-aurora-animated" : "backdrop-aurora backdrop-aurora-static"}>
        <div className="backdrop-bloom backdrop-bloom-1" style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.55), transparent 70%)" }} />
        <div className="backdrop-bloom backdrop-bloom-2" style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.5), transparent 70%)" }} />
        <div className="backdrop-bloom backdrop-bloom-3" style={{ background: "radial-gradient(closest-side, hsl(var(--season-accent, var(--accent)) / 0.4), transparent 70%)" }} />
      </div>
    </div>
  );
}
