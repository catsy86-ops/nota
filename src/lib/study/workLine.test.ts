import { describe, it, expect } from "vitest";
import { workLine, workMinutesOf, type ReportWork } from "./report";

describe("workMinutesOf", () => {
  it("cały dzień na tej budowie (brak pola site) — pełne minuty", () => {
    expect(workMinutesOf({ label: "Dniówka", minutes: 480 })).toBe(480);
  });

  it("dzień nierozdzielony (site: null) nie wchodzi do sumy", () => {
    expect(workMinutesOf({ label: "Dniówka", minutes: 480, site: null })).toBe(0);
  });

  it("dzień podzielony — tylko część tej budowy", () => {
    expect(workMinutesOf({ label: "Dniówka", minutes: 480, site: 300 })).toBe(300);
  });
});

describe("workLine", () => {
  it("bez godzin (0 min) pokazuje samą etykietę", () => {
    expect(workLine({ label: "Urlop", minutes: 0 })).toBe("Urlop");
  });

  it("dzień na kilku budowach bez podziału godzin jest nazwany wprost", () => {
    const w: ReportWork = { label: "Dniówka", minutes: 480, site: null };
    expect(workLine(w)).toContain("dzień na kilku budowach, godziny nierozdzielone");
  });

  it("część dnia na tej budowie: podaje też cały dzień", () => {
    const line = workLine({ label: "Dniówka", minutes: 480, site: 300 });
    expect(line).toContain("na tej budowie");
    expect(line).toContain("(z ");
    expect(line).toContain("Dniówka)");
  });

  it("podział na budowy: nierozdzielona część jako znak zapytania", () => {
    const line = workLine({
      label: "Dniówka",
      minutes: 480,
      bySite: [{ site: "Lipowa", minutes: 240 }, { site: "Leśna", minutes: null }],
    });
    expect(line).toContain("Lipowa: ");
    expect(line).toContain("Leśna: ?");
  });
});
