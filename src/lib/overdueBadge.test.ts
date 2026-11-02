import { describe, expect, it } from "vitest";
import { appBadgeCount } from "./overdueBadge";

describe("appBadgeCount (Skrzynka 5.3)", () => {
  it("domyślnie tylko zaległe, jak dotąd", () => {
    expect(appBadgeCount(3, 5, { overdueOn: true, inboxOn: false })).toBe(3);
  });

  it("Skrzynka dokładana, gdy włączona; sama Skrzynka bez zaległych", () => {
    expect(appBadgeCount(3, 5, { overdueOn: true, inboxOn: true })).toBe(8);
    expect(appBadgeCount(3, 5, { overdueOn: false, inboxOn: true })).toBe(5);
  });

  it("obie wyłączone = bez znaczka", () => {
    expect(appBadgeCount(3, 5, { overdueOn: false, inboxOn: false })).toBe(0);
  });
});
