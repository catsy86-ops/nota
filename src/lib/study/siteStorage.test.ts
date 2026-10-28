import { describe, expect, it } from "vitest";
import { measure, siteStorageRefs } from "./siteStorage";
import type { JournalEntry } from "./yStudy";

const e = (id: string, extra: Partial<JournalEntry>): JournalEntry =>
  ({ id, at: 1, kind: "ok", topic: null, text: "x", site: "Lipowa 5", siteId: "lipowa", checked: [], images: [], ...extra }) as JournalEntry;

describe("miejsce budowy (P3.1)", () => {
  it("zbiera zdjęcia, zdjęcia po naprawie, nagrania i dokumenty tej budowy bez duplikatów", () => {
    const journal = [
      e("a", { images: ["i1", "i2"], recordings: [{ hash: "r1", name: "n", size: 300, type: "audio/webm" }] }),
      e("b", { kind: "problem", images: ["i1"], after: ["i3"] }),
      e("c", { siteId: "inna", site: "Inna", images: ["x9"] }),
    ];
    const refs = siteStorageRefs(journal, { id: "lipowa", docs: [{ id: "d1", name: "Rzut", size: 500, type: "image/png", at: 1 }] });
    expect([...refs.keys()].sort()).toEqual(["d1", "i1", "i2", "i3", "r1"]);
    expect(refs.get("r1")).toBe(300);
    expect(refs.get("i1")).toBeUndefined();
  });

  it("liczy znane rozmiary i dociąga brakujące; nieobecne na urządzeniu = 0", async () => {
    const refs = new Map<string, number | undefined>([["a", 100], ["b", undefined], ["c", undefined]]);
    const sizes: Record<string, number> = { b: 50 };
    expect(await measure(refs, async (r) => sizes[r])).toBe(150);
  });
});
