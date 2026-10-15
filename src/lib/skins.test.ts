import { describe, expect, it } from "vitest";
import { SKINS, SKIN_SCHEME, isSkin } from "./skins";
import { SKIN_META } from "./skinGallery";

describe("skins", () => {
  it("rozpoznaje tylko znane style", () => {
    expect(isSkin("neon")).toBe(true);
    expect(isSkin("matrix")).toBe(false);
    expect(isSkin(null)).toBe(false);
  });
  it("tylko Zeszyt nie ma własnego schematu", () => {
    expect(SKINS.filter((s) => SKIN_SCHEME[s] === null)).toEqual(["zeszyt"]);
  });
  it("każdy styl ma opis w galerii", () => {
    for (const s of SKINS) expect(SKIN_META[s].label).toBeTruthy();
  });
});
