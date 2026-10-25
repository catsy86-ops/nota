import { describe, expect, it } from "vitest";
import { SITE_PARAM, readSiteParam, siteCardUrl } from "./siteLink";

describe("link do karty budowy", () => {
  it("buduje adres z zakodowanym id", () => {
    expect(siteCardUrl("abc")).toBe("/praca?budowa=abc");
    expect(siteCardUrl("a b&c")).toBe("/praca?budowa=a%20b%26c");
  });

  it("czyta id z query, pusty parametr to brak", () => {
    expect(readSiteParam(`?${SITE_PARAM}=lipowa&x=1`)).toBe("lipowa");
    expect(readSiteParam(`?${SITE_PARAM}=`)).toBeNull();
    expect(readSiteParam("?raport=dzis")).toBeNull();
  });
});
