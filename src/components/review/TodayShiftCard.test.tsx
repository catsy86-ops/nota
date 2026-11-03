import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const shiftsState = vi.hoisted(() => ({ ready: true, data: { types: [] as unknown[], days: {} as Record<string, unknown> }, current: null as unknown, next: null as unknown, ended: null as unknown, now: null as Date | null }));

vi.mock("@/lib/shifts", () => ({
  useShifts: () => shiftsState.data,
  useShiftsReady: () => shiftsState.ready,
}));

// Czas zmiany (G2.1) liczy hook; tu podajemy gotowy wynik.
vi.mock("@/lib/shifts/useShiftNow", () => ({
  useShiftNow: () => ({ now: shiftsState.now ?? new Date(), current: shiftsState.current, next: shiftsState.next, ended: shiftsState.ended }),
}));

import { TodayShiftCard } from "./TodayShiftCard";
import { localDayKey } from "@/lib/dayDone";

afterEach(() => {
  cleanup();
  shiftsState.ready = true;
  shiftsState.data = { types: [], days: {} };
  shiftsState.current = null;
  shiftsState.next = null;
  shiftsState.ended = null;
  shiftsState.now = null;
});

describe("TodayShiftCard", () => {
  it("bez wpisu na dziś mówi, że nie ma zmiany", () => {
    render(<TodayShiftCard onOpenShifts={() => {}} onDailyNote={() => {}} />);
    expect(screen.getByTestId("today-shift").textContent).toContain("Dziś nie ma zmiany w grafiku.");
  });

  it("pokazuje nazwę i godziny zmiany z dzisiejszego dnia", () => {
    shiftsState.data = {
      types: [{ id: "r", name: "Ranna", short: "R", color: "amber", start: "06:00", end: "14:00", breakMin: 0 }],
      days: { [localDayKey()]: { type: "r" } },
    };
    render(<TodayShiftCard onOpenShifts={() => {}} onDailyNote={() => {}} />);
    expect(screen.getByTestId("today-shift").textContent).toContain("Ranna, 06:00–14:00");
  });

  it("zaplanowana zmiana z usuniętym rodzajem nie znika bez śladu", () => {
    shiftsState.data = { types: [], days: { [localDayKey()]: { type: "zniknął" } } };
    render(<TodayShiftCard onOpenShifts={() => {}} onDailyNote={() => {}} />);
    expect(screen.getByTestId("today-shift").textContent).toContain("rodzaj usunięty");
  });

  it("przed wczytaniem Grafiku nie udaje brak zmiany", () => {
    shiftsState.ready = false;
    render(<TodayShiftCard onOpenShifts={() => {}} onDailyNote={() => {}} />);
    // Dziś 1.3: szkielet z aria-busy zamiast napisu; nie ma „nie ma zmiany”.
    expect(screen.getByLabelText("Wczytuję grafik").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByText(/nie ma zmiany/)).toBeNull();
  });

  it("przyciski wywołują podane akcje", () => {
    let shifts = 0;
    let daily = 0;
    render(<TodayShiftCard onOpenShifts={() => shifts++} onDailyNote={() => daily++} />);
    screen.getByRole("button", { name: /Grafik/ }).click();
    screen.getByRole("button", { name: /Notatka dnia/ }).click();
    expect([shifts, daily]).toEqual([1, 1]);
  });
});

describe("TodayShiftCard — czas zmiany (G2.1)", () => {
  it("trwająca zmiana pokazuje, do kiedy trwa", () => {
    shiftsState.current = { start: new Date(2026, 9, 27, 8, 0), end: new Date(2026, 9, 27, 16, 0) };
    render(<TodayShiftCard onOpenShifts={() => {}} onDailyNote={() => {}} />);
    expect(screen.getByTestId("today-timing").textContent).toBe("Trwa teraz, do 16:00");
    expect(Number(screen.getByRole("progressbar", { name: "Postęp zmiany" }).getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(0);
  });

  it("bez zmiany teraz pokazuje najbliższą", () => {
    shiftsState.next = { start: new Date(Date.now() + 3 * 3600_000) };
    render(<TodayShiftCard onOpenShifts={() => {}} onDailyNote={() => {}} />);
    expect(screen.getByTestId("today-timing").textContent).toMatch(/^Zaczynasz za .*, o \d\d:\d\d$/);
  });
});

describe("TodayShiftCard — notatka dnia na karcie (Dziś 2.6)", () => {
  const dayNote = (over: Record<string, unknown> = {}) => ({
    id: "d1", title: "", content: "Pierwsza linia\n\nDruga linia\nTrzecia", locked: false,
    checklist: [{ id: "a", text: "x", checked: true }, { id: "b", text: "y", checked: false }], ...over,
  }) as never;

  it("bez notatki dnia przycisk zakłada ją", () => {
    render(<TodayShiftCard onOpenShifts={() => {}} onDailyNote={() => {}} dailyNote={null} />);
    expect(screen.getByRole("button", { name: "Notatka dnia" })).toBeTruthy();
    expect(screen.queryByTestId("today-daily-preview")).toBeNull();
  });

  it("z notatką dnia: „Dopisz”, pierwsze dwie linie i licznik odhaczeń", () => {
    render(<TodayShiftCard onOpenShifts={() => {}} onDailyNote={() => {}} dailyNote={dayNote()} />);
    expect(screen.getByRole("button", { name: "Dopisz" })).toBeTruthy();
    const preview = screen.getByTestId("today-daily-preview");
    expect(preview.textContent).toContain("Pierwsza linia");
    expect(preview.textContent).toContain("Druga linia");
    expect(preview.textContent).not.toContain("Trzecia");
    expect(preview.textContent).toContain("Odhaczone: 1 z 2");
  });

  it("prywatna notatka dnia nie pokazuje treści", () => {
    render(<TodayShiftCard onOpenShifts={() => {}} onDailyNote={() => {}} dailyNote={dayNote({ locked: true, content: "" })} />);
    expect(screen.getByTestId("today-daily-preview").textContent).toContain("Notatka dnia jest w skarbcu.");
  });
});

describe("TodayShiftCard — Dziś 2.1, 2.2, 3.1", () => {
  const types = [
    { id: "r", name: "Ranna", short: "R", color: "#f59e0b", start: "06:00", end: "14:00", breakMin: 0 },
    { id: "u", name: "Urlop", short: "U", color: "#10b981", start: "08:00", end: "16:00", breakMin: 0, kind: "absence" },
  ];

  it("znaczek zmiany w jej kolorze, a urlop spokojnie (bez koloru zmiany)", () => {
    shiftsState.data = { types, days: { [localDayKey()]: { type: "r" } } };
    render(<TodayShiftCard onOpenShifts={() => {}} onDailyNote={() => {}} />);
    expect(screen.getByTestId("today-badge").textContent).toBe("R");
    expect(screen.getByTestId("today-badge").style.backgroundColor).not.toBe("");
    cleanup();
    shiftsState.data = { types, days: { [localDayKey()]: { type: "u" } } };
    render(<TodayShiftCard onOpenShifts={() => {}} onDailyNote={() => {}} />);
    expect(screen.getByTestId("today-badge").style.backgroundColor).toBe("");
    expect(screen.getByTestId("today-shift").textContent).toBe("Urlop");
  });

  it("po zmianie: „skończyła się o” i „Skończyłem teraz”", () => {
    shiftsState.ended = { start: new Date(2026, 9, 27, 6, 0), end: new Date(2026, 9, 27, 14, 0), dayKey: "2026-10-27", entry: { type: "r" }, type: types[0] };
    render(<TodayShiftCard onOpenShifts={() => {}} onDailyNote={() => {}} />);
    expect(screen.getByTestId("today-timing").textContent).toBe("Zmiana skończyła się o 14:00");
    expect(screen.getByRole("button", { name: "Skończyłem teraz" })).toBeTruthy();
  });

  it("wieczorem wiersz „Jutro” z jutrzejszą zmianą i terminami; rano go nie ma", () => {
    const evening = new Date(2026, 10, 3, 19, 0);
    shiftsState.now = evening;
    shiftsState.data = { types, days: { [localDayKey(new Date(2026, 10, 4))]: { type: "r" } } };
    const reminderNotes = [{ reminder: new Date(2026, 10, 4, 9, 0).getTime(), trashed: false }];
    let opened = 0;
    render(<TodayShiftCard onOpenShifts={() => {}} onDailyNote={() => {}} reminderNotes={reminderNotes} onOpenTomorrow={() => { opened++; }} />);
    expect(screen.getByTestId("today-tomorrow").textContent).toBe("Jutro: R 06:00–14:00 · 1 termin");
    screen.getByTestId("today-tomorrow").click();
    expect(opened).toBe(1);
    cleanup();
    shiftsState.now = new Date(2026, 10, 3, 9, 0);
    render(<TodayShiftCard onOpenShifts={() => {}} onDailyNote={() => {}} reminderNotes={reminderNotes} onOpenTomorrow={() => {}} />);
    expect(screen.queryByTestId("today-tomorrow")).toBeNull();
  });
});
