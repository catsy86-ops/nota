import { useMotionPref } from "@/hooks/useMotionPref";

/**
 * Warm "sunset" backdrop — static gradient wash + two slow-drifting blobs.
 *
 * Performance notes:
 * - No JS: no scroll listener, no rAF loop, no per-frame style writes.
 * - Pure CSS keyframes on `transform` only (compositor thread).
 * - Two blobs instead of three, blur baked into the radial gradient (no `filter`).
 * - `contain: strict` isolates layout/paint from the rest of the page.
 * - Fully static (no animation) in reduced-motion mode.
 */
export function AnimatedBackdrop() {
  const { reduced } = useMotionPref();

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ contain: "strict" }}
    >
      {/* Base warm wash */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--background))] to-[hsl(var(--season-wash)/0.5)]" />

      <div
        className={reduced ? "backdrop-blob backdrop-blob-1" : "backdrop-blob backdrop-blob-1 backdrop-blob-animated"}
        style={{
          background:
            "radial-gradient(closest-side, hsl(var(--season-blob-1) / 0.4), hsl(var(--season-blob-1) / 0.16) 45%, transparent 72%)",
        }}
      />
      <div
        className={reduced ? "backdrop-blob backdrop-blob-2" : "backdrop-blob backdrop-blob-2 backdrop-blob-animated"}
        style={{
          background:
            "radial-gradient(closest-side, hsl(var(--season-blob-2) / 0.4), hsl(var(--season-blob-2) / 0.16) 45%, transparent 72%)",
        }}
      />

      {/* Subtle static grain */}
      <div className="backdrop-grain" />
    </div>
  );
}
