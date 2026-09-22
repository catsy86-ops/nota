import confetti from "canvas-confetti";
import { isEffectEnabled, type EffectKey } from "./effectsSettings";
import { isMotionReduced } from "@/hooks/useMotionPref";

/**
 * Per-effect throttle (minimum ms between triggers) to prevent spam from
 * rapid repeated clicks. Fireworks also tracks an "active" flag so a running
 * loop cannot be re-triggered until it finishes.
 */
const THROTTLE_MS: Record<EffectKey, number> = {
  confetti: 400,
  sparkle: 150,
  emojiShower: 1500,
  fireworks: 2000,
  hearts: 600,
  bubbles: 600,
  rainbow: 2500,
  snow: 0,
  seasonalTheme: 0,
  dailyQuote: 0,
};

const lastFiredAt: Record<EffectKey, number> = {
  confetti: 0,
  sparkle: 0,
  emojiShower: 0,
  fireworks: 0,
  hearts: 0,
  bubbles: 0,
  rainbow: 0,
  snow: 0,
  seasonalTheme: 0,
  dailyQuote: 0,
};

let fireworksActive = false;

function canFire(key: EffectKey): boolean {
  // Motion-sensitive users get no particle animations at all.
  if (isMotionReduced()) return false;
  if (!isEffectEnabled(key)) return false;
  const now = Date.now();
  if (now - lastFiredAt[key] < THROTTLE_MS[key]) return false;
  lastFiredAt[key] = now;
  return true;
}

function hslVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? `hsl(${raw})` : fallback;
}

function themeColors(): string[] {
  return [
    hslVar("--primary", "hsl(220 90% 60%)"),
    hslVar("--accent", "hsl(280 80% 65%)"),
    hslVar("--secondary", "hsl(160 70% 55%)"),
  ];
}

function originFrom(x: number, y: number) {
  return { x: x / window.innerWidth, y: y / window.innerHeight };
}

export function celebrate(originX: number, originY: number) {
  if (!canFire("confetti")) return;
  confetti({
    particleCount: 60,
    spread: 65,
    startVelocity: 35,
    ticks: 120,
    scalar: 0.85,
    origin: originFrom(originX, originY),
    colors: themeColors(),
    disableForReducedMotion: true,
  });
}

export function sparkle(originX: number, originY: number) {
  if (!canFire("sparkle")) return;
  confetti({
    particleCount: 18,
    spread: 360,
    startVelocity: 14,
    ticks: 60,
    scalar: 0.6,
    shapes: ["circle"],
    gravity: 0.4,
    origin: originFrom(originX, originY),
    colors: themeColors(),
    disableForReducedMotion: true,
  });
}

export function emojiShower(emojis: string[] = ["🎉", "✨", "⭐", "💫"]) {
  if (typeof window === "undefined") return;
  if (!canFire("emojiShower")) return;
  const shapeFromText = (confetti as unknown as {
    shapeFromText: (opts: { text: string; scalar?: number }) => unknown;
  }).shapeFromText;
  const shapes = emojis.map((e) => shapeFromText({ text: e, scalar: 2 }) as never);
  confetti({
    particleCount: 40,
    spread: 100,
    startVelocity: 25,
    ticks: 200,
    gravity: 0.7,
    scalar: 2,
    shapes,
    origin: { x: 0.5, y: 0 },
    disableForReducedMotion: true,
  });
}

export function fireworks(durationMs = 1500) {
  if (typeof window === "undefined") return;
  if (fireworksActive) return;
  if (!canFire("fireworks")) return;
  fireworksActive = true;
  const end = Date.now() + durationMs;
  const colors = themeColors();
  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors,
      disableForReducedMotion: true,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors,
      disableForReducedMotion: true,
    });
    if (Date.now() < end) {
      requestAnimationFrame(frame);
    } else {
      fireworksActive = false;
    }
  })();
}

/** Floating hearts (emoji shapes rising up). */
export function hearts(originX?: number, originY?: number) {
  if (typeof window === "undefined") return;
  if (!canFire("hearts")) return;
  const shapeFromText = (confetti as unknown as {
    shapeFromText: (opts: { text: string; scalar?: number }) => unknown;
  }).shapeFromText;
  const shapes = ["❤️", "💖", "💗", "💕"].map((e) => shapeFromText({ text: e, scalar: 1.6 }) as never);
  const origin = originX != null && originY != null
    ? originFrom(originX, originY)
    : { x: 0.5, y: 0.7 };
  confetti({
    particleCount: 22,
    spread: 70,
    startVelocity: 28,
    gravity: 0.45,
    ticks: 180,
    scalar: 1.6,
    shapes,
    origin,
    disableForReducedMotion: true,
  });
}

/** Soft bubbles drifting upward. */
export function bubbles(originX?: number, originY?: number) {
  if (typeof window === "undefined") return;
  if (!canFire("bubbles")) return;
  const origin = originX != null && originY != null
    ? originFrom(originX, originY)
    : { x: 0.5, y: 1 };
  confetti({
    particleCount: 30,
    spread: 50,
    startVelocity: 20,
    gravity: -0.25,
    ticks: 240,
    scalar: 1.1,
    shapes: ["circle"],
    colors: ["#a5f3fc", "#bae6fd", "#e0f2fe", "#ffffff"],
    origin,
    disableForReducedMotion: true,
  });
}

/** Rainbow arc burst across the screen. */
export function rainbow() {
  if (typeof window === "undefined") return;
  if (!canFire("rainbow")) return;
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];
  // Fire from left and right with arching trajectories
  for (let i = 0; i < 7; i++) {
    setTimeout(() => {
      confetti({
        particleCount: 40,
        angle: 60 + i * 8,
        spread: 30,
        startVelocity: 55,
        origin: { x: 0, y: 1 },
        colors,
        ticks: 200,
        disableForReducedMotion: true,
      });
      confetti({
        particleCount: 40,
        angle: 120 - i * 8,
        spread: 30,
        startVelocity: 55,
        origin: { x: 1, y: 1 },
        colors,
        ticks: 200,
        disableForReducedMotion: true,
      });
    }, i * 80);
  }
}

/** Mega easter-egg show: combine everything for ~3s. */
export function megaCelebrate() {
  if (typeof window === "undefined") return;
  rainbow();
  setTimeout(() => fireworks(2500), 300);
  setTimeout(() => emojiShower(["🎉", "✨", "⭐", "🥳", "🦆"]), 600);
  setTimeout(() => hearts(window.innerWidth / 2, window.innerHeight / 2), 900);
  setTimeout(() => bubbles(), 1200);
}
