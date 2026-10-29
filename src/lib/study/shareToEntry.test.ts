import { describe, it, expect } from "vitest";
import { splitShared } from "./shareToEntry";

const refs = (n: number, from = 0) => Array.from({ length: n }, (_, i) => String(from + i).padStart(64, "a"));

describe("zdjęcia z udostępnienia do wpisu (H4.1)", () => {
  it("do 5 zdjęć — całe do szkicu", () => {
    expect(splitShared([], refs(3))).toEqual({ draft: refs(3), rest: [] });
  });

  it("ponad limit — reszta w paczkach po 5, kolejność zostaje", () => {
    const r = refs(12);
    expect(splitShared([], r)).toEqual({ draft: r.slice(0, 5), rest: [r.slice(5, 10), r.slice(10)] });
  });

  it("szkic ze zdjęciami: do szkicu tylko tyle, ile się zmieści; bez duplikatów", () => {
    const old = refs(4, 100);
    const r = refs(3);
    expect(splitShared(old, [old[0], ...r])).toEqual({ draft: [r[0]], rest: [r.slice(1)] });
  });
});
