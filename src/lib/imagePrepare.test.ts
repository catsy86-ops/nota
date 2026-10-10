import { describe, expect, it } from "vitest";
import { fitWithin, prepareImage } from "./imagePrepare";

describe("fitWithin", () => {
  it("nie powiększa i zachowuje proporcje", () => {
    expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(1000, 5000, 1000)).toEqual({ width: 200, height: 1000 });
  });
});

describe("prepareImage", () => {
  it("małe pliki przechodzą bez zmian", async () => {
    const f = new File([new Uint8Array(100)], "a.png", { type: "image/png" });
    expect(await prepareImage(f)).toBe(f);
  });

  it("zbyt duży GIF nie jest przekodowywany", async () => {
    const f = new File([new Uint8Array(3000)], "a.gif", { type: "image/gif" });
    expect(await prepareImage(f, 1000)).toBeNull();
  });
});
