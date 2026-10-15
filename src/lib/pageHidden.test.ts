import { afterEach, describe, expect, it } from "vitest";
import { installPageHidden } from "./pageHidden";

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("installPageHidden", () => {
  let uninstall = () => {};
  afterEach(() => {
    uninstall();
    setHidden(false);
    document.documentElement.removeAttribute("data-hidden");
  });

  it("przełącza data-hidden razem z widocznością karty", () => {
    setHidden(false);
    uninstall = installPageHidden();
    expect(document.documentElement.hasAttribute("data-hidden")).toBe(false);
    setHidden(true);
    expect(document.documentElement.hasAttribute("data-hidden")).toBe(true);
    setHidden(false);
    expect(document.documentElement.hasAttribute("data-hidden")).toBe(false);
  });

  it("ustawia znacznik od razu, gdy karta startuje w tle", () => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    uninstall = installPageHidden();
    expect(document.documentElement.hasAttribute("data-hidden")).toBe(true);
  });
});
