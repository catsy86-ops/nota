import { describe, expect, it } from "vitest";
import { buildPushSchedule } from "@/lib/push/schedule";
import { studyReminders } from "./reminders";
import {
  addServiceCall, cleanServiceCalls, closeServiceCall, dueServiceCalls, openServiceCalls, reopenServiceCall, warrantyDaysLeft,
} from "./service";
import { cleanSite } from "./sites";

const at = (day: number, h = 12) => new Date(2026, 9, day, h).getTime();

describe("serwis i gwarancja", () => {
  it("dodanie, zamknięcie z opisem, ponowne otwarcie", () => {
    let list = addServiceCall([], "  Cieknie syfon  ", "2026-10-20", at(16), "v1");
    list = addServiceCall(list, "Głośny rozdzielacz", undefined, at(17), "v2");
    expect(list).toEqual([
      { id: "v1", text: "Cieknie syfon", at: at(16), due: "2026-10-20" },
      { id: "v2", text: "Głośny rozdzielacz", at: at(17) },
    ]);
    expect(addServiceCall(list, "  ", undefined, at(18))).toHaveLength(2);
    list = closeServiceCall(list, "v1", "wymieniona uszczelka", at(20));
    expect(list[0]).toMatchObject({ done: at(20), solution: "wymieniona uszczelka" });
    expect(openServiceCalls(list).map((c) => c.id)).toEqual(["v2"]);
    list = reopenServiceCall(list, "v1");
    expect(list[0].done).toBeUndefined();
    expect(list[0].solution).toBe("wymieniona uszczelka");
  });

  it("otwarte: z terminem najpierw (najbliższy), potem bez; należne dziś i zaległe", () => {
    const list = [
      { id: "a", text: "A", at: 1 },
      { id: "b", text: "B", at: 2, due: "2026-10-22" },
      { id: "c", text: "C", at: 3, due: "2026-10-15" },
      { id: "d", text: "D", at: 4, due: "2026-10-16", done: 5 },
    ];
    expect(openServiceCalls(list).map((c) => c.id)).toEqual(["c", "b", "a"]);
    expect(dueServiceCalls(list, "2026-10-16").map((c) => c.id)).toEqual(["c"]);
  });

  it("czyszczenie i karta: zły termin wypada, gwarancja jako dzień", () => {
    expect(cleanServiceCalls([{ id: "a", text: "x", at: 1, due: "jutro" }, { id: "b", text: "", at: 2 }])).toEqual([{ id: "a", text: "x", at: 1 }]);
    const card = cleanSite({ id: "s", name: "Lipowa", address: "", investor: "", created: 1, warranty: "2028-10-16", service: [{ id: "a", text: "x", at: 1 }] });
    expect(card).toMatchObject({ warranty: "2028-10-16", service: [{ id: "a", text: "x", at: 1 }] });
    expect(cleanSite({ id: "s", name: "Lipowa", address: "", investor: "", created: 1, warranty: "kiedyś" })).not.toHaveProperty("warranty");
  });

  it("dni gwarancji", () => {
    expect(warrantyDaysLeft("2026-10-20", "2026-10-16")).toBe(4);
    expect(warrantyDaysLeft("2026-10-16", "2026-10-16")).toBe(0);
    expect(warrantyDaysLeft("2026-10-10", "2026-10-16")).toBe(-6);
  });

  it("przypomnienie w Dzienniku: serwis na dziś także na budowie w archiwum", () => {
    const sites = { s: { id: "s", name: "Lipowa", archived: 1, service: [
      { id: "a", text: "Cieknie syfon", at: 1, due: "2026-10-16" },
      { id: "b", text: "Później", at: 2, due: "2026-10-30" },
    ] } };
    expect(studyReminders([], at(16), sites)).toEqual([{ kind: "service-due", siteId: "s", site: "Lipowa", items: ["Cieknie syfon"] }]);
  });

  it("push: rano w dniu wizyty, zamknięte i przeszłe pomija", () => {
    const sites = { s: { id: "s", name: "Lipowa", archived: 1, service: [
      { id: "a", text: "Cieknie syfon", at: 1, due: "2026-10-20" },
      { id: "b", text: "Załatwione", at: 2, due: "2026-10-21", done: 3 },
      { id: "c", text: "Wczoraj", at: 2, due: "2026-10-15" },
    ] } };
    const items = buildPushSchedule({ now: at(16), notes: [], sites });
    expect(items).toEqual([{ key: "v:a:2026-10-20", at: at(20, 7), title: "Serwis dziś: Lipowa", body: "Cieknie syfon", url: "/praca" }]);
  });
});
