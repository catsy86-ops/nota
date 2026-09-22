import { useEffect, useRef } from "react";
import { useMotionPref } from "@/hooks/useMotionPref";

/**
 * Warm "sunset" animated backdrop with subtle scroll parallax.
 *
 * Performance notes:
 * - Pure CSS keyframes (compositor-only `transform`), no JS/rAF animation loops.
 * - Parallax is one passive scroll listener throttled to a single rAF frame,
 *   writing a CSS variable; the blobs translate on the compositor.
 * - Blur is baked into radial gradients instead of an expensive filter.
 * - Parallax + animations switch off in reduced-motion mode.
 */
export function AnimatedBackdrop() {
  const { reduced } = useMotionPref();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (reduced) {
      el.style.setProperty("--scroll", "0px");
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      // Cap so long pages don't push the blobs completely out of view.
      el.style.setProperty("--scroll", `${Math.min(y, 1600)}px`);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduced]);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ contain: "strict" }}
    >
      {/* Base warm wash */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--background))] to-[hsl(var(--season-wash)/0.5)]" />

      {/* Coral blob — slowest layer */}
      <div className="backdrop-parallax" style={{ ["--depth" as string]: "0.06" }}>
        <div
          className="backdrop-blob backdrop-blob-1"
          style={{
            background:
              "radial-gradient(closest-side, hsl(var(--season-blob-1) / 0.45), hsl(var(--season-blob-1) / 0.18) 45%, transparent 72%)",
          }}
        />
      </div>
      {/* Sun blob — mid layer */}
      <div className="backdrop-parallax" style={{ ["--depth" as string]: "-0.1" }}>
        <div
          className="backdrop-blob backdrop-blob-2"
          style={{
            background:
              "radial-gradient(closest-side, hsl(var(--season-blob-2) / 0.45), hsl(var(--season-blob-2) / 0.18) 45%, transparent 72%)",
          }}
        />
      </div>
      {/* Magenta accent blob — fastest layer */}
      <div className="backdrop-parallax" style={{ ["--depth" as string]: "0.16" }}>
        <div
          className="backdrop-blob backdrop-blob-3"
          style={{
            background:
              "radial-gradient(closest-side, hsl(var(--season-blob-3) / 0.4), hsl(var(--season-blob-3) / 0.15) 45%, transparent 72%)",
          }}
        />
      </div>

      {/* Subtle static grain */}
      <div className="backdrop-grain" />
    </div>
  );
}
