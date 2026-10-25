import { beforeEach, describe, expect, it, vi } from "vitest";
import { yjsStore } from "@/lib/yjsStore";
import { enterEntryCheck, entryCheckDump, leaveEntryCheck, mergeEntryCheckDump } from "./entryCheckStore";

// Lista przed wejściem na budowę (Etap 5 § 5.6): wejście, wyjście, zrzut i scalanie zrzutu.
const SITE = "Lipowa 5";
const DAY = "2026-10-14";
const T0 = new Date(2026, 9, 14, 8).getTime();
const T1 = new Date(2026, 9, 14, 16).getTime();

describe("entryCheckStore", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 14, 12));
    await yjsStore.resetForTests();
  });

  it("wejście zostawia ślad w zrzucie, a wyjście dopisuje godzinę", () => {
    enterEntryCheck(SITE, DAY, T0);
    const afterEnter = JSON.stringify(entryCheckDump());
    expect(afterEnter).toContain(String(T0));
    leaveEntryCheck(SITE, DAY, T1);
    expect(JSON.stringify(entryCheckDump())).toContain(String(T1));
  });

  it("wyjście bez wejścia nic nie zmienia", () => {
    const before = JSON.stringify(entryCheckDump());
    leaveEntryCheck(SITE, DAY, T1);
    expect(JSON.stringify(entryCheckDump())).toBe(before);
  });

  it("scalanie zrzutu z samym sobą jest bez skutku", () => {
    enterEntryCheck(SITE, DAY, T0);
    const dump = entryCheckDump();
    const before = JSON.stringify(entryCheckDump());
    mergeEntryCheckDump(dump);
    expect(JSON.stringify(entryCheckDump())).toBe(before);
  });
});
