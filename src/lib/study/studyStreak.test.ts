import { describe, expect, it } from "vitest";
import { cleanDump, stateFromDump } from "./studyDump";

// W12: dzień z przyszłości (błędny zegar drugiego telefonu) nie psuje serii.
const dump = (days: string[]) => cleanDump({ days });

describe("seria nauki a dni z przyszłości", () => {
  it("zwykła seria: kolejne dni do dziś", () => {
    const s = stateFromDump(dump(["2026-11-09", "2026-11-10", "2026-11-11"]), "2026-11-11");
    expect(s.lastDay).toBe("2026-11-11");
    expect(s.streak).toBe(3);
  });

  it("dzień z odległej przyszłości jest pomijany, seria liczy się od ostatniego prawdziwego dnia", () => {
    const s = stateFromDump(dump(["2026-11-10", "2026-11-11", "2031-01-01"]), "2026-11-11");
    expect(s.lastDay).toBe("2026-11-11");
    expect(s.streak).toBe(2);
  });

  it("jutro (zapas na strefy czasowe) jest jeszcze dopuszczone", () => {
    const s = stateFromDump(dump(["2026-11-11", "2026-11-12"]), "2026-11-11");
    expect(s.lastDay).toBe("2026-11-12");
    expect(s.streak).toBe(2);
  });
});
