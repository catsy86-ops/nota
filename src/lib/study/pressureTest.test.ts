import { describe, expect, it } from "vitest";
import { cleanTest, defaultTest, testLine, addReading, cancelRun, clockLabel, elapsedSec, finishRun, isRunning, READINGS_MAX, readingsLine, remainingSec, runEndsAt, startRun } from "./pressureTest";

describe("protokół próby szczelności", () => {
  it("domyślny protokół zależy od tematu", () => {
    expect(defaultTest("proba-kan")).toMatchObject({ medium: "sewer", bar: null, ok: true });
    expect(defaultTest("proba-wody")).toMatchObject({ medium: "air", bar: 6 });
  });

  it("cleanTest odrzuca śmieci, przy kanalizacji gubi ciśnienie i spadek", () => {
    expect(cleanTest(null)).toBeNull();
    expect(cleanTest({ medium: "gaz", ok: true })).toBeNull();
    expect(cleanTest({ medium: "water", bar: 9 })).toBeNull();
    expect(cleanTest({ medium: "water", bar: 9.004, minutes: 30, drop: -1, ok: true })).toEqual({ medium: "water", bar: 9, minutes: 30, drop: null, ok: true });
    expect(cleanTest({ medium: "sewer", bar: 9, drop: 1, minutes: 15, ok: false })).toEqual({ medium: "sewer", bar: null, minutes: 15, drop: null, ok: false });
  });

  it("testLine: czytelny opis z polskim przecinkiem dziesiętnym", () => {
    expect(testLine({ medium: "air", bar: 6, minutes: 30, drop: 0.1, ok: true })).toBe("Próba szczelności (powietrze, 6 bar, 30 min, spadek 0,1 bar): szczelna");
    expect(testLine({ medium: "sewer", bar: null, minutes: null, drop: null, ok: false })).toBe("Próba na zalanie (kanalizacja): nieszczelna");
  });
});

describe("minutnik próby (B3.1)", () => {
  const T0 = 1_700_000_000_000;
  const base = defaultTest("proba-wody");

  it("startRun zapisuje start i pierwszy odczyt; licznik liczy się z startedAt", () => {
    const t = startRun(base, 6, 30, T0);
    expect(t).toMatchObject({ bar: 6, minutes: 30, drop: null, startedAt: T0, readings: [{ at: 0, bar: 6 }] });
    expect(isRunning(t)).toBe(true);
    expect(elapsedSec(t, T0 + 90_000)).toBe(90);
    expect(remainingSec(t, T0 + 90_000)).toBe(1800 - 90);
    expect(remainingSec(t, T0 + 40 * 60_000)).toBe(0); // po czasie
    expect(runEndsAt(t)).toBe(T0 + 30 * 60_000);
    expect(elapsedSec(t, T0 - 5000)).toBe(0); // zegar cofnięty
  });

  it("stan przeżywa zapis i odczyt (cleanTest)", () => {
    const t = addReading(startRun(base, 6, 30, T0), 5.9, T0 + 15 * 60_000);
    expect(cleanTest(JSON.parse(JSON.stringify(t)))).toEqual(t);
    expect(cleanTest({ ...t, startedAt: -1 })?.startedAt).toBeUndefined();
  });

  it("addReading: odczyt w tej samej sekundzie nadpisuje, kolejność rośnie, limit 60", () => {
    let t = startRun(base, 6, 30, T0);
    t = addReading(t, 5.95, T0 + 60_000);
    t = addReading(t, 5.9, T0 + 60_000);
    expect(t.readings).toEqual([{ at: 0, bar: 6 }, { at: 60, bar: 5.9 }]);
    for (let i = 2; i < 100; i++) t = addReading(t, 5, T0 + i * 1000);
    expect(t.readings!.length).toBe(READINGS_MAX);
  });

  it("finishRun: spadek z odczytów, czas faktyczny, wynik; start znika", () => {
    const run = addReading(startRun(base, 6, 30, T0), 6, T0 + 15 * 60_000);
    const ok = finishRun(run, 6, T0 + 30 * 60_000);
    expect(ok).toMatchObject({ drop: 0, minutes: 30, ok: true });
    expect(ok.startedAt).toBeUndefined();
    expect(ok.readings!.at(-1)).toEqual({ at: 1800, bar: 6 });

    const leak = finishRun(run, 5.7, T0 + 30 * 60_000);
    expect(leak).toMatchObject({ drop: 0.3, ok: false });

    // Wskazanie wyższe niż na starcie (temperatura) nie daje ujemnego spadku.
    expect(finishRun(run, 6.1, T0 + 31 * 60_000).drop).toBe(0);
    // Krótka próba: czas z dokładnością do 0,1 min.
    expect(finishRun(startRun(base, 6, 1, T0), 6, T0 + 3000).minutes).toBe(0.1);
  });

  it("cancelRun: zostaje protokół bez startu i odczytów", () => {
    const t = cancelRun(startRun(base, 6, 30, T0));
    expect(t.startedAt).toBeUndefined();
    expect(t.readings).toBeUndefined();
    expect(t.medium).toBe("air");
  });

  it("readingsLine i clockLabel", () => {
    const t = finishRun(addReading(startRun(base, 6, 30, T0), 5.9, T0 + 15 * 60_000), 5.9, T0 + 30 * 60_000);
    expect(readingsLine(t)).toBe("0 min 6 bar → 15 min 5,9 bar → 30 min 5,9 bar");
    expect(readingsLine(base)).toBe("");
    expect(clockLabel(752)).toBe("12:32");
    expect(clockLabel(3723)).toBe("1:02:03");
    expect(clockLabel(5)).toBe("0:05");
  });
});

describe("cleanTest i minutnik: granice", () => {
  it("odczyty: ujemny czas przycina do 0, ponad 60 ucina, przy kanalizacji znikają", () => {
    const water = cleanTest({ medium: "water", bar: 6, minutes: 30, drop: 0, ok: true, readings: [{ at: -5, bar: 6 }, { at: "x", bar: 6 }, { at: 10, bar: NaN }] });
    expect(water?.readings).toEqual([{ at: 0, bar: 6 }]);
    const many = Array.from({ length: READINGS_MAX + 20 }, (_, i) => ({ at: i, bar: 6 }));
    expect(cleanTest({ medium: "air", bar: 6, minutes: 30, drop: 0, ok: true, readings: many })?.readings).toHaveLength(READINGS_MAX);
    expect(cleanTest({ medium: "sewer", bar: 6, minutes: 30, drop: 0, ok: true, readings: [{ at: 1, bar: 6 }] })?.readings).toBeUndefined();
  });

  it("ok musi być boolean", () => {
    expect(cleanTest({ medium: "water", bar: 6, ok: "tak" })).toBeNull();
    expect(cleanTest({ medium: "water", bar: 6, ok: 1 })).toBeNull();
  });

  it("bez czasu próby nie ma końca ani pozostałego czasu", () => {
    const t = { medium: "air" as const, bar: 6, minutes: null, drop: null, ok: true, startedAt: 1_000 };
    expect(remainingSec(t, 5_000)).toBe(0);
    expect(runEndsAt(t)).toBeNull();
  });

  it("finishRun przy kanalizacji (bez ciśnienia) zostawia wynik bez zmian", () => {
    const t = { medium: "sewer" as const, bar: null, minutes: 15, drop: null, ok: false, startedAt: 0 };
    const done = finishRun(t, 0, 60_000);
    expect(done.drop).toBe(0);
    const sewerNoReadings = finishRun({ ...t, readings: undefined }, 0, 60_000);
    expect(sewerNoReadings.startedAt).toBeUndefined();
  });
});

