import { describe, expect, it } from "vitest";
import { codeFromPaste } from "./yjsSync";
import { codeFromScan } from "./qrScan";
import { pairCodeFromLocation, pairLink, pairTextIsV3 } from "./pairLink";

describe("link parowania (S11)", () => {
  it("nowy link niesie kod we fragmencie, nie w zapytaniu", () => {
    const link = pairLink("https://notki.example", "/", "ABCDEFGHJKMN");
    expect(link).toBe("https://notki.example/#pair=ABCDEFGHJKMN");
    expect(new URL(link).search).toBe("");
  });

  it("kod czytany z fragmentu i ze starego zapytania; fragment wygrywa", () => {
    expect(pairCodeFromLocation("", "#pair=abcd")).toBe("abcd");
    expect(pairCodeFromLocation("?pair=wxyz", "")).toBe("wxyz");
    expect(pairCodeFromLocation("?pair=stary", "#pair=nowy")).toBe("nowy");
    expect(pairCodeFromLocation("?x=1", "#inne=2")).toBeNull();
  });

  it("wklejony link i kod ze skanera rozumieją oba formaty", () => {
    expect(codeFromPaste("https://x.pl/#pair=abcd-efgh-jkmn")).toBe(codeFromPaste("https://x.pl/?pair=abcd-efgh-jkmn"));
    expect(codeFromScan("https://x.pl/#pair=abcdefghjkmn")).toBe(codeFromScan("https://x.pl/?pair=abcdefghjkmn"));
    expect(codeFromScan("https://x.pl/#pair=abcdefghjkmn")).not.toBeNull();
  });
});

describe("link parowania z v=3 (S2.6)", () => {
  it("grupa bez pokoju v2 dostaje &v=3; bez flagi link jak dawniej", () => {
    expect(pairLink("https://n.example", "/", "ABCDEFGHJKMN", true)).toBe("https://n.example/#pair=ABCDEFGHJKMN&v=3");
    expect(pairLink("https://n.example", "/", "ABCDEFGHJKMN")).toBe("https://n.example/#pair=ABCDEFGHJKMN");
  });
  it("v=3 rozpoznane tylko w linku parowania; kod z takiego linku czytany bez zmian", () => {
    expect(pairTextIsV3("https://n.example/#pair=ABCDEFGHJKMN&v=3")).toBe(true);
    expect(pairTextIsV3("https://n.example/#pair=ABCDEFGHJKMN")).toBe(false);
    expect(pairTextIsV3("https://n.example/#pair=ABCDEFGHJKMN&v=30")).toBe(false);
    expect(pairTextIsV3("v=3")).toBe(false);
    expect(pairCodeFromLocation("", "#pair=ABCDEFGHJKMN&v=3")).toBe("ABCDEFGHJKMN");
    expect(codeFromScan("https://n.example/#pair=ABCDEFGHJKMN&v=3")).toBe("ABCDEFGHJKMN");
  });
});
