import { useMotionPref } from "@/hooks/useMotionPref";

/**
 * Animated mesh-gradient backdrop — three soft color blooms in the app's
 * own primary/accent/secondary hues, slowly drifting and overlapping to
 * create a flowing gradient-mesh feel.
 *
 * Performance notes:
 * - No JS: no scroll listener, no rAF loop, no per-frame style writes.
 * - Pure CSS keyframes on `transform` only (compositor thread), no `filter`.
 * - Blur is baked into the radial gradients themselves.
 * - `contain: strict` isolates layout/paint from the rest of the page.
 * - Fully static in reduced-motion mode.
 */
export function AnimatedBackdrop() {
  const { reduced } = useMotionPref();
  const animated = !reduced;
  const cls = (n: 1 | 2 | 3) => (animated ? `backdrop-bloom backdrop-bloom-${n} backdrop-bloom-animated` : `backdrop-bloom backdrop-bloom-${n}`);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
      style={{ contain: "strict" }}
    >
      <div className={cls(1)} style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.22), transparent 70%)" }} />
      <div className={cls(2)} style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.2), transparent 70%)" }} />
      <div className={cls(3)} style={{ background: "radial-gradient(closest-side, hsl(var(--season-accent, var(--accent)) / 0.16), transparent 70%)" }} />
    </div>
  );
}
