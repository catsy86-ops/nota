import { describe, expect, it } from "vitest";
import { weekSeparators } from "./journalWeeks";

describe("separatory tygodni na osi (P5.3)", () => {
  it("separator przy pierwszym (najnowszym) dniu każdego tygodnia, z sumą godzin tygodnia", () => {
    // 2026-10-27 (wt) i 26 (pn) — tydzień 44; 24 (sob) i 20 (wt) — tydzień 43.
    const days = ["2026-10-27", "2026-10-26", "2026-10-24", "2026-10-20"];
    const minutes: Record<string, number> = { "2026-10-27": 480, "2026-10-26": 240, "2026-10-24": 0, "2026-10-20": 600 };
    const seps = weekSeparators(days, (d) => minutes[d] ?? 0);
    expect([...seps.keys()]).toEqual(["2026-10-27", "2026-10-24"]);
    expect(seps.get("2026-10-27")).toMatchObject({ start: "2026-10-26", minutes: 720 });
    expect(seps.get("2026-10-24")).toMatchObject({ start: "2026-10-19", minutes: 600 });
    expect(seps.get("2026-10-27")!.label).toMatch(/^Tydz\. 44 · /);
  });
});
