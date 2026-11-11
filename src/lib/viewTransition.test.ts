import { afterEach, describe, expect, it, vi } from "vitest";
import { canViewTransition, isWebKitOnly, withViewTransition } from "./viewTransition";

const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const CHROME_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1";
const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
const CHROME_DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const EDGE = `${CHROME_DESKTOP} Edg/120.0`;
const SAFARI_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

afterEach(() => { delete (document as { startViewTransition?: unknown }).startViewTransition; vi.restoreAllMocks(); });

describe("viewTransition", () => {
  it("rozpoznaje WebKit (Safari, Chrome na iOS), nie Chromium", () => {
    for (const ua of [SAFARI, CHROME_IOS, SAFARI_MAC]) expect(isWebKitOnly(ua), ua).toBe(true);
    for (const ua of [CHROME_ANDROID, CHROME_DESKTOP, EDGE]) expect(isWebKitOnly(ua), ua).toBe(false);
  });

  it("withViewTransition: bez API albo w WebKit od razu, w Chromium przez przejście", () => {
    const update = vi.fn();
    withViewTransition(update);
    expect(update).toHaveBeenCalledTimes(1); // brak API w jsdom
    const start = vi.fn((cb: () => void) => cb());
    (document as { startViewTransition?: unknown }).startViewTransition = start;
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(CHROME_DESKTOP);
    expect(canViewTransition()).toBe(true);
    const u2 = vi.fn();
    withViewTransition(u2);
    expect(start).toHaveBeenCalledTimes(1);
    expect(u2).toHaveBeenCalledTimes(1);
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(SAFARI);
    expect(canViewTransition()).toBe(false);
    const u3 = vi.fn();
    withViewTransition(u3);
    expect(start).toHaveBeenCalledTimes(1); // bez przejścia
    expect(u3).toHaveBeenCalledTimes(1);
  });
});
