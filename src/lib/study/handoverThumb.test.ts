import { describe, expect, it } from "vitest";
import { shrinkDimensions } from "./photoShrink";
import { HANDOVER_THUMB_MAX_SIDE, handoverThumbBlob } from "./handoverThumb";

describe("miniatury zdjęć na protokole (P6.4)", () => {
  it("miniatura ma dłuższy bok co najwyżej 360 px, proporcje zostają", () => {
    expect(HANDOVER_THUMB_MAX_SIDE).toBe(360);
    expect(shrinkDimensions(4032, 3024, HANDOVER_THUMB_MAX_SIDE)).toEqual({ width: 360, height: 270 });
    expect(shrinkDimensions(3024, 4032, HANDOVER_THUMB_MAX_SIDE)).toEqual({ width: 270, height: 360 });
  });
  it("zdjęcie już małe nie dostaje miniatury (protokół pokazuje oryginał)", () => {
    expect(shrinkDimensions(320, 240, HANDOVER_THUMB_MAX_SIDE)).toBeNull();
  });
  it("adres danych i nieznany klucz dają null bez dotykania magazynu", async () => {
    expect(await handoverThumbBlob("data:image/png;base64,AAAA")).toBeNull();
    expect(await handoverThumbBlob("0".repeat(64))).toBeNull();
  });
});
