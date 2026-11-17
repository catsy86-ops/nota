import { describe, expect, it } from "vitest";
import { EMPTY_SHIFT_DATA, type ShiftData } from "@/lib/shifts/model";
import { buildPushSchedulePlan, PUSH_MAX_ITEMS, type PushNote } from "./schedule";
import { planNative } from "@/lib/reminders/nativePlan";
import { fitKeepalive, KEEPALIVE_MAX_BYTES } from "./client";

const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const HOUR = 3600_000;
const DAY = 24 * HOUR;

const note = (i: number) =>
  ({ id: `n${i}`, title: `T${i}`, content: "", reminder: NOW + (i + 1) * HOUR, reminderRepeat: "none", locked: false }) as never;

describe("limit harmonogramu push (S1 audytu 2: obcinanie po czasie)", () => {
  it("bez przekroczenia limitu nic nie odpada", () => {
    const plan = buildPushSchedulePlan({ now: NOW, notes: [note(0), note(1)] });
    expect(plan).toEqual({ items: expect.any(Array), total: 2, dropped: 0, droppedBy: {}, horizonEnd: null });
    expect(plan.items).toHaveLength(2);
  });

  it("nad limitem odpada najpóźniejsze przypomnienie, liczby i koniec horyzontu się zgadzają", () => {
    const notes = Array.from({ length: PUSH_MAX_ITEMS + 1 }, (_, i) => note(i));
    const plan = buildPushSchedulePlan({ now: NOW, notes });
    expect(plan.items).toHaveLength(PUSH_MAX_ITEMS);
    expect(plan.total).toBe(PUSH_MAX_ITEMS + 1);
    expect(plan.dropped).toBe(1);
    expect(plan.droppedBy).toEqual({ notatki: 1 });
    expect(plan.items.some((i) => i.title === "T200")).toBe(false);
    expect(plan.horizonEnd).toBe(NOW + PUSH_MAX_ITEMS * HOUR);
  });

  it("bliższy termin wygrywa niezależnie od grupy: jutrzejszy serwis zostaje, odpada najdalsza notatka", () => {
    const notes = Array.from({ length: PUSH_MAX_ITEMS }, (_, i) => note(i));
    const sites = { s: { name: "Lipowa", service: [{ id: "c1", text: "przegląd", at: 0, due: "2026-10-14" }] } } as never;
    const plan = buildPushSchedulePlan({ now: NOW - 3 * HOUR, notes, sites });
    expect(plan.items.some((i) => i.key.startsWith("v:"))).toBe(true);
    expect(plan.droppedBy).toEqual({ notatki: 1 });
  });

  it("10 notatek dziennych z zapowiedzią i zmiana jutro: budzik zmiany zostaje w liście", () => {
    const work = { id: "w", name: "Dzień", short: "D", color: "#000", start: "06:00", end: "14:00", breakMin: 0, kind: "work" as const };
    const shifts: ShiftData = { ...EMPTY_SHIFT_DATA, types: [work], days: { "2026-10-15": { type: "w" } } };
    const notes: PushNote[] = Array.from({ length: 10 }, (_, i) => ({
      id: `d${i}`, title: `Codziennie ${i}`, content: "", reminder: NOW + (i + 1) * 60_000, reminderRepeat: "daily", reminderLead: 15,
    }));
    const plan = buildPushSchedulePlan({ now: NOW, notes, shifts });
    // Zapowiedzi tylko dla 3 najbliższych wystąpień każdej serii.
    for (const n of notes) expect(plan.items.filter((i) => i.key.startsWith(`n:${n.id}:`) && i.key.endsWith(":lead"))).toHaveLength(3);
    expect(plan.items.some((i) => i.key === "a:2026-10-15")).toBe(true);
  });

  it("koniec próby szczelności nigdy nie odpada, nawet daleko za limitem", () => {
    const notes = Array.from({ length: PUSH_MAX_ITEMS + 50 }, (_, i) => note(i));
    const endsAt = NOW + 13 * DAY;
    const plan = buildPushSchedulePlan({ now: NOW, notes, pressure: { startedAt: NOW - HOUR, endsAt } });
    expect(plan.items).toHaveLength(PUSH_MAX_ITEMS);
    expect(plan.items.some((i) => i.key.startsWith("t:"))).toBe(true);
  });
});

describe("strażnik przy obciętej liście (S2 audytu 2)", () => {
  it("obcięcie → strażnik dobę przed końcem listy; bez obcięcia i bez terminów przy końcu horyzontu — brak", () => {
    const notes = Array.from({ length: PUSH_MAX_ITEMS + 10 }, (_, i) => note(i));
    const plan = buildPushSchedulePlan({ now: NOW, notes });
    const cut = planNative(plan.items, [], NOW, { horizonEnd: plan.horizonEnd, dropped: plan.dropped });
    const sentinel = cut.schedule.find((a) => a.key === "sentinel");
    expect(sentinel).toBeDefined();
    expect(sentinel!.at).toBeLessThanOrEqual(plan.horizonEnd! - DAY + HOUR);
    expect(sentinel!.at).toBeGreaterThanOrEqual(plan.horizonEnd! - DAY - HOUR);

    const short = buildPushSchedulePlan({ now: NOW, notes: [note(0)] });
    const none = planNative(short.items, [], NOW, { horizonEnd: short.horizonEnd, dropped: short.dropped });
    expect(none.schedule.some((a) => a.key === "sentinel")).toBe(false);
  });

  it("lista obcięta tuż przed teraz: strażnik nie wcześniej niż za godzinę", () => {
    const plan = planNative([], [], NOW, { horizonEnd: NOW + 2 * HOUR, dropped: 5 });
    const sentinel = plan.schedule.find((a) => a.key === "sentinel");
    expect(sentinel!.at).toBeGreaterThanOrEqual(NOW + HOUR);
  });
});

describe("wysyłka przy chowaniu aplikacji (S3 audytu 2)", () => {
  it("200 pozycji o maksymalnej długości: treść żądania ≤ 60 KB, najbliższe zostają", () => {
    const long = "Łódź żółć ".repeat(12).slice(0, 120);
    const items = Array.from({ length: PUSH_MAX_ITEMS }, (_, i) => ({
      key: `n:x${i}:${NOW + i}`, at: NOW + i * HOUR, title: long, body: long.repeat(2), url: `/notatka/${"x".repeat(30)}${i}`,
    }));
    const subscription = { endpoint: `https://push.example/${"e".repeat(200)}`, keys: { p256dh: "k".repeat(88), auth: "a".repeat(24) } };
    const body = (list: typeof items) => ({ subscription, items: list });
    const sent = fitKeepalive(body, items);
    expect(new TextEncoder().encode(JSON.stringify(body(sent))).length).toBeLessThanOrEqual(KEEPALIVE_MAX_BYTES);
    expect(sent.length).toBeLessThan(items.length);
    expect(sent).toEqual(items.slice(0, sent.length));
    // Mała lista przechodzi bez zmian.
    expect(fitKeepalive(body, items.slice(0, 3))).toHaveLength(3);
  });
});
