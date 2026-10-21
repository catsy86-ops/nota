import { beforeEach, describe, expect, it } from "vitest";
import { REPORT_NUDGES_KEY, reportNudgesStore, setReportNudges } from "./reportNudgePrefs";

describe("podpowiedzi o raportach Nauki", () => {
  beforeEach(() => {
    localStorage.clear();
    setReportNudges(true);
  });

  it("domyślnie włączone", () => {
    expect(reportNudgesStore.get()).toBe(true);
  });

  it("wyłączenie zapisuje się i wraca", () => {
    setReportNudges(false);
    expect(reportNudgesStore.get()).toBe(false);
    expect(localStorage.getItem(REPORT_NUDGES_KEY)).toBe("false");
    setReportNudges(true);
    expect(reportNudgesStore.get()).toBe(true);
  });
});
