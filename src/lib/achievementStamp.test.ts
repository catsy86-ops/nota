import { describe, it, expect, beforeEach } from "vitest";
import { showAchievementStamp, dismissAchievementStamp, isFirstTimeBadge } from "./achievementStamp";
import { setEffectEnabled } from "./effectsSettings";

describe("achievementStamp", () => {
  beforeEach(() => {
    setEffectEnabled("badgeStamp", true);
    dismissAchievementStamp();
  });

  it("rozpoznaje odznaki pierwszego razu", () => {
    expect(isFirstTimeBadge("first-note")).toBe(true);
    expect(isFirstTimeBadge("first-list")).toBe(true);
    expect(isFirstTimeBadge("ten-notes")).toBe(false);
  });

  it("zwraca false, gdy efekt wyłączony", () => {
    setEffectEnabled("badgeStamp", false);
    expect(showAchievementStamp({ id: "x", emoji: "🏅", title: "T" })).toBe(false);
  });
});
