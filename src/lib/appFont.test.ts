import { afterEach, describe, expect, it } from "vitest";
import { APP_FONTS, isAppFont, setAppFont } from "./appFont";

describe("appFont", () => {
  afterEach(() => setAppFont("default"));

  it("domyślny plus sześć krojów do wyboru", () => {
    expect(APP_FONTS.filter((f) => f !== "default")).toHaveLength(6);
    expect(isAppFont("literata")).toBe(true);
    expect(isAppFont("comic-sans")).toBe(false);
  });

  it("ustawia html[data-font], domyślny go zdejmuje", () => {
    setAppFont("atkinson");
    expect(document.documentElement.dataset.font).toBe("atkinson");
    setAppFont("default");
    expect(document.documentElement.dataset.font).toBeUndefined();
  });
});
