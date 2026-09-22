import { isMotionReduced } from "@/hooks/useMotionPref";

/**
 * Ultra-light "glow & streak" micro-interactions.
 *
 * No libraries, no React re-renders: a single fixed overlay layer with
 * short-lived DOM nodes animated by the Web Animations API (compositor-only
 * transform/opacity). Everything is skipped in reduced-motion mode.
 */

export type Point = { x: number; y: number };

const LAYER_ID = "glow-fx-layer";

function layer(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let el = document.getElementById(LAYER_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = LAYER_ID;
    el.setAttribute("aria-hidden", "true");
    el.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden;contain:strict";
    document.body.appendChild(el);
  }
  return el;
}

function tone(kind: GlowKind): string {
  const varName =
    kind === "trash" ? "--destructive" : kind === "archive" ? "--accent" : "--primary";
  if (typeof window === "undefined") return "25 95% 53%";
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return raw || "25 95% 53%";
}

export type GlowKind = "create" | "archive" | "trash" | "move";

function enabled(): boolean {
  return typeof document !== "undefined" && !isMotionReduced();
}

/** Center point of an element, or null if it isn't on screen. */
export function centerOf(el: Element | null | undefined): Point | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function pointOfNote(id: string): Point | null {
  return centerOf(document.querySelector(`[data-note-id="${CSS.escape(id)}"]`));
}

/** Soft radial pulse that blooms and fades at a point. */
export function glowPulse(at: Point, kind: GlowKind = "create", size = 220) {
  if (!enabled()) return;
  const root = layer();
  if (!root) return;
  const h = tone(kind);

  const dot = document.createElement("div");
  dot.style.cssText = [
    "position:absolute",
    `left:${at.x - size / 2}px`,
    `top:${at.y - size / 2}px`,
    `width:${size}px`,
    `height:${size}px`,
    "border-radius:9999px",
    `background:radial-gradient(closest-side, hsl(${h} / 0.42), hsl(${h} / 0.16) 45%, transparent 72%)`,
    "will-change:transform,opacity",
  ].join(";");
  root.appendChild(dot);

  const anim = dot.animate(
    [
      { transform: "scale(0.35)", opacity: 0 },
      { transform: "scale(0.85)", opacity: 1, offset: 0.28 },
      { transform: "scale(1.25)", opacity: 0 },
    ],
    { duration: 720, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  );
  anim.onfinish = () => dot.remove();
  anim.oncancel = () => dot.remove();

  // A thin expanding ring adds crispness without extra cost.
  const ring = document.createElement("div");
  ring.style.cssText = [
    "position:absolute",
    `left:${at.x - size / 2}px`,
    `top:${at.y - size / 2}px`,
    `width:${size}px`,
    `height:${size}px`,
    "border-radius:9999px",
    `border:1.5px solid hsl(${h} / 0.5)`,
    "will-change:transform,opacity",
  ].join(";");
  root.appendChild(ring);
  const ringAnim = ring.animate(
    [
      { transform: "scale(0.3)", opacity: 0.9 },
      { transform: "scale(1)", opacity: 0 },
    ],
    { duration: 620, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  );
  ringAnim.onfinish = () => ring.remove();
  ringAnim.oncancel = () => ring.remove();
}

/** Comet-like streak travelling from one point to another. */
export function glowStreak(from: Point, to: Point, kind: GlowKind = "move") {
  if (!enabled()) return;
  const root = layer();
  if (!root) return;
  const h = tone(kind);

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 8) {
    glowPulse(to, kind, 180);
    return;
  }
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const len = Math.min(Math.max(dist * 0.45, 60), 220);

  const streak = document.createElement("div");
  streak.style.cssText = [
    "position:absolute",
    `left:${from.x}px`,
    `top:${from.y - 5}px`,
    `width:${len}px`,
    "height:10px",
    "border-radius:9999px",
    `background:linear-gradient(90deg, transparent, hsl(${h} / 0.55), hsl(${h} / 0.9))`,
    "filter:blur(1px)",
    `transform-origin:0 50%`,
    "will-change:transform,opacity",
  ].join(";");
  root.appendChild(streak);

  const anim = streak.animate(
    [
      {
        transform: `rotate(${angle}deg) translateX(-${len}px) scaleX(0.4)`,
        opacity: 0,
      },
      { transform: `rotate(${angle}deg) translateX(0px) scaleX(1)`, opacity: 1, offset: 0.35 },
      {
        transform: `rotate(${angle}deg) translateX(${dist - len}px) scaleX(0.55)`,
        opacity: 0,
      },
    ],
    { duration: 520, easing: "cubic-bezier(0.3, 0.9, 0.3, 1)" },
  );
  anim.onfinish = () => streak.remove();
  anim.oncancel = () => streak.remove();

  window.setTimeout(() => glowPulse(to, kind, 170), 380);
}

/** Convenience: glow at a note card (falls back to a viewport point). */
export function glowAtNote(id: string, kind: GlowKind, fallback?: Point | null) {
  const p = pointOfNote(id) || fallback;
  if (p) glowPulse(p, kind);
}

/** Convenience: streak from a note card to a target element. */
export function streakFromNoteTo(id: string, target: Element | null, kind: GlowKind = "move") {
  const from = pointOfNote(id);
  const to = centerOf(target);
  if (from && to) glowStreak(from, to, kind);
  else if (to) glowPulse(to, kind);
  else if (from) glowPulse(from, kind);
}
