import { beforeEach, describe, expect, it } from "vitest";
import { CARD_SECTIONS, isCardSection, rememberSection, requestCardSection, resetCardSectionsForTests, sectionOfPanel, startSection, visibleSections } from "./cardSection";

beforeEach(resetCardSectionsForTests);

describe("sekcje karty budowy", () => {
  it("panele z paska liczników trafiają do swoich segmentów", () => {
    expect(sectionOfPanel("site-stages")).toBe("dzis");
    expect(sectionOfPanel("site-shortages")).toBe("material");
    expect(sectionOfPanel("site-order")).toBe("material");
    expect(sectionOfPanel("site-points")).toBe("punkty");
    expect(sectionOfPanel("nieznany")).toBeNull();
  });

  it("fucha nie ma segmentu Pieniądze", () => {
    expect(visibleSections(false)).toEqual([...CARD_SECTIONS]);
    expect(visibleSections(true)).not.toContain("pieniadze");
  });

  it("start: żądanie raz, potem zapamiętany segment budowy, potem Dziś", () => {
    const all = visibleSections(false);
    expect(startSection("a", all)).toBe("dzis");
    rememberSection("a", "punkty");
    expect(startSection("a", all)).toBe("punkty");
    expect(startSection("b", all)).toBe("dzis");
    requestCardSection("material");
    expect(startSection("a", all)).toBe("material");
    expect(startSection("a", all)).toBe("punkty");
  });

  it("zapamiętany segment, którego fucha nie ma, wraca do Dziś", () => {
    rememberSection("a", "pieniadze");
    expect(startSection("a", visibleSections(true))).toBe("dzis");
  });

  it("isCardSection odrzuca śmieci", () => {
    expect(isCardSection("papiery")).toBe(true);
    expect(isCardSection("x")).toBe(false);
    expect(isCardSection(3)).toBe(false);
  });
});
