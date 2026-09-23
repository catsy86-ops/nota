import { useMotionPref } from "@/hooks/useMotionPref";

/**
 * Calm ambient backdrop — flat background with two very soft, slow-breathing
 * color blooms in the app's own primary/accent hues (no seasonal palette,
 * no grain texture).
 *
 * Performance notes:
 * - No JS: no scroll listener, no rAF loop, no per-frame style writes.
 * - Pure CSS keyframes on `opacity`/`transform` only (compositor thread).
 * - Blur baked into the radial gradient (no `filter`).
 * - `contain: strict` isolates layout/paint from the rest of the page.
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
      <div
        className={animated ? "backdrop-bloom backdrop-bloom-1 backdrop-bloom-animated" : "backdrop-bloom backdrop-bloom-1"}
        style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.14), transparent 70%)" }}
      />
      <div
        className={animated ? "backdrop-bloom backdrop-bloom-2 backdrop-bloom-animated" : "backdrop-bloom backdrop-bloom-2"}
        style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.12), transparent 70%)" }}
      />
    </div>
  );
}
