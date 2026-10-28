import { describe, expect, it } from "vitest";
import { durationLabel, liveMinutes, monthHours, siteMonthCsv } from "./siteTime";

describe("czas na budowie (P2.8)", () => {
  it("licznik od wejścia: liczy minuty, nic po wyjściu ani bez wejścia", () => {
    const at = new Date(2026, 9, 14, 7, 12).getTime();
    expect(liveMinutes({ at }, at + 125 * 60_000)).toBe(125);
    expect(liveMinutes({ at, leftAt: at + 60_000 }, at + 125 * 60_000)).toBeNull();
    expect(liveMinutes(undefined, at)).toBeNull();
    expect(durationLabel(125)).toBe("2 h 05 min");
    expect(durationLabel(45)).toBe("45 min");
  });

  it("miesiąc: suma godzin, kwota przy stawce, dni bez podziału osobno", () => {
    const days = [{ day: "2026-10-01", minutes: 480 }, { day: "2026-10-02", minutes: null }, { day: "2026-10-03", minutes: 270 }];
    expect(monthHours(days, 45)).toEqual({ minutes: 750, unsplit: 1, amount: 562.5 });
    expect(monthHours(days, undefined).amount).toBeNull();
    const csv = siteMonthCsv(days, 45);
    expect(csv.startsWith("\uFEFFData;Godziny;Stawka (zł/h);Kwota (zł);Uwagi")).toBe(true);
    expect(csv).toContain("2026-10-01;8,00;45,00;360,00;");
    expect(csv).toContain("2026-10-02;;;;kilka budów bez podziału godzin");
    expect(csv).toContain("Razem;12,50;45,00;562,50;dni bez podziału: 1");
  });
});
