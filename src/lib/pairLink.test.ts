import { describe, expect, it } from "vitest";
import { codeFromPaste } from "./yjsSync";
import { codeFromScan } from "./qrScan";
import { pairCodeFromLocation, pairLink } from "./pairLink";

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
