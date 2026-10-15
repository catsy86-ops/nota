import { afterEach, describe, expect, it } from "vitest";
import { isSiteModeActive, resolveSiteMode, setSiteMode, undoToastDuration } from "./siteMode";

describe("siteMode", () => {
  afterEach(() => setSiteMode("off"));

  it("auto słucha prośby systemu o większy kontrast", () => {
    expect(resolveSiteMode("off", true)).toBe(false);
    expect(resolveSiteMode("on", false)).toBe(true);
    expect(resolveSiteMode("auto", true)).toBe(true);
    expect(resolveSiteMode("auto", false)).toBe(false);
  });

  it("ustawia html[data-site] i wydłuża „Cofnij” do 8 s", () => {
    setSiteMode("on");
    expect(isSiteModeActive()).toBe(true);
    expect(document.documentElement.hasAttribute("data-site")).toBe(true);
    expect(undoToastDuration()).toBe(8000);
    expect(undoToastDuration(10000)).toBe(10000);
    setSiteMode("off");
    expect(document.documentElement.hasAttribute("data-site")).toBe(false);
    expect(undoToastDuration()).toBe(5000);
  });
});
