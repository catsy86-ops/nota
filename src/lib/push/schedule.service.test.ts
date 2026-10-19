import { describe, expect, it } from "vitest";
import { buildPushSchedule } from "./schedule";

// Środa 14 października 2026, 5:00 lokalnie — przed porannym przypomnieniem (7:00).
const WED_EARLY = new Date(2026, 9, 14, 5, 0).getTime();
const WED_7 = new Date(2026, 9, 14, 7, 0).getTime();
const THU_7 = new Date(2026, 9, 15, 7, 0).getTime();

function sites(service: { id: string; text: string; due?: string; done?: number }[]) {
  return { s1: { name: "Kopernika", service: service.map((c) => ({ at: 0, ...c })) } } as never;
}
const serviceItems = (items: ReturnType<typeof buildPushSchedule>) => items.filter((i) => i.key.startsWith("v:"));

describe("serwis w harmonogramie push", () => {
  it("wizyta dziś: przypomnienie rano tego dnia, a jutro rano drugie, jeśli nadal otwarta", () => {
    // Harmonogram wysyłany jest w całości przy każdej zmianie: zamknięta wizyta usuwa też jutrzejsze przypomnienie.
    const items = serviceItems(buildPushSchedule({ now: WED_EARLY, notes: [], sites: sites([{ id: "c1", text: "przegląd", due: "2026-10-14" }]) }));
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: "Serwis dziś: Kopernika", at: WED_7, key: "v:c1:2026-10-14" });
    expect(items[1]).toMatchObject({ title: "Serwis zaległy: Kopernika", at: THU_7, key: "v:c1:2026-10-14+1" });
  });

  it("wizyta z wczoraj wciąż otwarta: przypomnienie jutro rano, z osobnym kluczem", () => {
    const items = serviceItems(buildPushSchedule({ now: WED_EARLY, notes: [], sites: sites([{ id: "c1", text: "przegląd", due: "2026-10-13" }]) }));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "Serwis zaległy: Kopernika", at: WED_7, key: "v:c1:2026-10-13+1" });
  });

  it("wizyta z przedwczoraj: poranek następnego dnia już minął, więc nic nie wysyłamy", () => {
    const items = serviceItems(buildPushSchedule({ now: WED_EARLY, notes: [], sites: sites([{ id: "c1", text: "przegląd", due: "2026-10-12" }]) }));
    expect(items).toEqual([]);
  });

  it("zamknięta wizyta nie daje żadnego przypomnienia", () => {
    const items = serviceItems(buildPushSchedule({ now: WED_EARLY, notes: [], sites: sites([{ id: "c1", text: "przegląd", due: "2026-10-14", done: WED_EARLY - 1 }]) }));
    expect(items).toEqual([]);
  });
});
