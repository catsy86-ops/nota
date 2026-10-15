import { beforeEach, describe, expect, it } from "vitest";
import { countSwipe, showSwipeLabels, SWIPE_HINT_KEY, SWIPE_HINT_LIMIT } from "./swipeHint";

describe("swipeHint", () => {
  beforeEach(() => localStorage.removeItem(SWIPE_HINT_KEY));

  it("podpisy przy pierwszych gestach, potem same ikony", () => {
    for (let i = 0; i < SWIPE_HINT_LIMIT; i++) {
      expect(showSwipeLabels()).toBe(true);
      countSwipe();
    }
    expect(showSwipeLabels()).toBe(false);
    countSwipe();
    expect(localStorage.getItem(SWIPE_HINT_KEY)).toBe(String(SWIPE_HINT_LIMIT));
  });

  it("śmieci w kluczu liczą się jak zero", () => {
    localStorage.setItem(SWIPE_HINT_KEY, "abc");
    expect(showSwipeLabels()).toBe(true);
  });
});
