import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import {
  buildMarkerUpdate, canCancelRekey, canSkipMarker, cancelRekey, markerOf, parseRekeyRecord, prepareRekey, pruneMarkers,
  readMarkers, rekeyFinished, rekeyTag, runRekey, stoppingMarker, withDevicePaired,
  MARKER_TTL_MS, RETIRE_AFTER_MS, RETIRE_GIVE_UP_MS, SYNC_CONTROL_MAP,
  type RekeyPorts, type RekeyRecord,
} from "@/lib/sync/rekey";

const TAG_OLD = "a".repeat(32);
const TAG_NEW = "b".repeat(32);

/** Porty w pamięci z dziennikiem wywołań; `fail` wskazuje operacje, które mają rzucić. */
function fakePorts(over: Partial<RekeyPorts> = {}) {
  const log: string[] = [];
  const fail = new Set<string>();
  const state = { record: null as RekeyRecord | null, code: "STARYKODAAAA" as string | null, now: 1_000_000, relay: "https://relay.test" as string | null, peers: 0, busy: false, retireOk: true };
  const doc = new Y.Doc();
  const op = (name: string) => {
    log.push(name);
    if (fail.has(name)) throw new Error(`${name} nie działa`);
  };
  const ports: RekeyPorts = {
    now: () => state.now,
    load: () => (state.record ? structuredClone(state.record) : null),
    save: (r) => { op("save"); state.record = r ? structuredClone(r) : null; },
    currentCode: () => state.code,
    newCode: () => "NOWYKOD".padEnd(28, "A"),
    tagFor: async (code) => (code === "STARYKODAAAA" ? TAG_OLD : TAG_NEW),
    relayUrl: () => state.relay,
    devices: () => [{ name: "Telefon", version: "2.1" }, { name: "Tablet" }],
    seedRoom: async () => op("seedRoom"),
    dropRoom: async () => op("dropRoom"),
    applyMarker: (u) => { op("applyMarker"); Y.applyUpdate(doc, u); },
    postMarker: async () => op("postMarker"),
    peers: () => state.peers,
    wait: async () => op("wait"),
    switchTo: (code) => { op("switchTo"); state.code = code; },
    retireRoom: async () => { op("retireRoom"); return state.retireOk; },
    forgetRoom: async () => op("forgetRoom"),
    lock: async (fn) => (state.busy ? null : fn()),
    ...over,
  };
  return { ports, log, fail, state, doc };
}

describe("znacznik „kod zmieniony”", () => {
  it("tag ma 32 znaki szesnastkowe i zależy od nazwy pokoju", async () => {
    const a = await rekeyTag("kaczy3-00");
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(await rekeyTag("kaczy3-00")).toBe(a);
    expect(await rekeyTag("kaczy3-01")).not.toBe(a);
  });

  it("wchodzi na dokument, który nie zna wcześniejszych operacji autora", () => {
    // Autor ma za sobą zmiany, których odbiorca nigdy nie dostał.
    const author = new Y.Doc();
    author.getText("t").insert(0, "dużo zmian, których odbiorca nie widział");
    const marker = { id: "1".repeat(32), tag: TAG_OLD, at: 5 };
    const update = buildMarkerUpdate(marker);
    Y.applyUpdate(author, update);

    const stale = new Y.Doc();
    stale.getText("t").insert(0, "własne");
    Y.applyUpdate(stale, update);
    expect(readMarkers(stale)).toEqual([marker]);
    expect(stale.store.pendingStructs).toBeNull();

    // Kontrprzykład: ta sama zmiana zrobiona wprost w dokumencie autora czeka u odbiorcy na poprzedników.
    const direct = new Y.Doc();
    direct.getText("t").insert(0, "wcześniejsze");
    const sv = Y.encodeStateVector(direct);
    direct.getMap(SYNC_CONTROL_MAP).set("rekey:" + "2".repeat(32), { v: 1, tag: TAG_OLD, at: 5 });
    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(direct, sv));
    expect(readMarkers(other)).toEqual([]);
  });

  it("powtórzony znacznik niczego nie psuje", () => {
    const doc = new Y.Doc();
    const marker = { id: "1".repeat(32), tag: TAG_OLD, at: 5 };
    Y.applyUpdate(doc, buildMarkerUpdate(marker));
    Y.applyUpdate(doc, buildMarkerUpdate(marker));
    expect(readMarkers(doc)).toEqual([marker]);
  });

  it("odrzuca wpisy o złym kształcie", () => {
    const doc = new Y.Doc();
    const map = doc.getMap(SYNC_CONTROL_MAP);
    map.set("rekey:" + "1".repeat(32), { v: 2, tag: TAG_OLD, at: 1 });
    map.set("rekey:" + "2".repeat(32), { v: 1, tag: "krótki", at: 1 });
    map.set("rekey:" + "3".repeat(32), { v: 1, tag: TAG_OLD, at: "wczoraj" });
    map.set("rekey:zły", { v: 1, tag: TAG_OLD, at: 1 });
    map.set("inne", { v: 1, tag: TAG_OLD, at: 1 });
    map.set("rekey:" + "4".repeat(32), "napis");
    expect(readMarkers(doc)).toEqual([]);
  });

  it("zatrzymuje tylko urządzenie z tym kodem, bez zignorowanych i bez własnej wymiany", () => {
    const doc = new Y.Doc();
    const id = "1".repeat(32);
    Y.applyUpdate(doc, buildMarkerUpdate({ id, tag: TAG_OLD, at: 5 }));
    expect(stoppingMarker(doc, TAG_OLD)?.id).toBe(id);
    expect(stoppingMarker(doc, TAG_NEW)).toBeNull();
    expect(stoppingMarker(doc, TAG_OLD, [id])).toBeNull();
    expect(stoppingMarker(doc, TAG_OLD, [], id)).toBeNull();
  });

  it("usuwa znaczniki starsze niż 180 dni", () => {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, buildMarkerUpdate({ id: "1".repeat(32), tag: TAG_OLD, at: 0 }));
    Y.applyUpdate(doc, buildMarkerUpdate({ id: "2".repeat(32), tag: TAG_OLD, at: MARKER_TTL_MS }));
    expect(pruneMarkers(doc, MARKER_TTL_MS + 1)).toBe(1);
    expect(readMarkers(doc).map((m) => m.id)).toEqual(["2".repeat(32)]);
  });
});

describe("zapis wymiany", () => {
  it("czyta tylko poprawny kształt", async () => {
    const { ports } = fakePorts();
    const { record } = await prepareRekey(ports);
    expect(parseRekeyRecord(JSON.stringify(record))).toEqual(record);
    expect(parseRekeyRecord(null)).toBeNull();
    expect(parseRekeyRecord("{")).toBeNull();
    expect(parseRekeyRecord(JSON.stringify({ ...record, v: 2 }))).toBeNull();
    expect(parseRekeyRecord(JSON.stringify({ ...record, step: "inny" }))).toBeNull();
    expect(parseRekeyRecord(JSON.stringify({ ...record, oldCode: null }))).toBeNull();
    expect(parseRekeyRecord(JSON.stringify({ ...record, step: "done", oldCode: null }))?.step).toBe("done");
  });
});

describe("sterownik wymiany", () => {
  it("bez potwierdzenia nic nie wychodzi poza urządzenie", async () => {
    const { ports, log } = fakePorts();
    const prepared = await prepareRekey(ports);
    expect(prepared.wait).toBe("confirm");
    expect(prepared.record).toMatchObject({ step: "prepared", tag: TAG_OLD, relay: "https://relay.test", devices: [{ name: "Telefon", version: "2.1", done: false }, { name: "Tablet", done: false }] });
    expect((await runRekey(ports)).wait).toBe("confirm");
    expect(log).toEqual(["save"]);
  });

  it("przechodzi kroki w kolejności: nowy pokój, znacznik, przełączenie; wycofanie czeka na termin", async () => {
    const { ports, log, state, doc } = fakePorts();
    await prepareRekey(ports);
    log.length = 0;
    const res = await runRekey(ports, { confirmed: true });
    expect(res.wait).toBe("retire");
    expect(log.filter((l) => l !== "save")).toEqual(["seedRoom", "applyMarker", "postMarker", "switchTo"]);
    expect(res.record).toMatchObject({ step: "switched", switchedAt: state.now, retireAt: state.now + RETIRE_AFTER_MS });
    expect(state.code).toBe(res.record!.newCode);
    expect(readMarkers(doc)).toEqual([markerOf(res.record!)]);

    // Przed terminem nic; po terminie nagrobek i koniec.
    log.length = 0;
    expect((await runRekey(ports)).wait).toBe("retire");
    expect(log).toEqual([]);
    state.now += RETIRE_AFTER_MS;
    const done = await runRekey(ports);
    expect(done.wait).toBe("idle");
    expect(done.record).toMatchObject({ step: "done", oldCode: null });
    expect(log.filter((l) => l !== "save")).toEqual(["retireRoom", "forgetRoom"]);
    expect(rekeyFinished(done.record!)).toBe(false);
    const paired = withDevicePaired(withDevicePaired(done.record!, "Telefon"), "Tablet");
    expect(rekeyFinished(paired)).toBe(true);
  });

  it("„Usuń teraz” nie czeka na termin", async () => {
    const { ports } = fakePorts();
    await prepareRekey(ports);
    await runRekey(ports, { confirmed: true });
    expect((await runRekey(ports, { retireNow: true })).record?.step).toBe("done");
  });

  it("anulowanie: przed znacznikiem usuwa zapis i nowy pokój, po nim jest niedostępne", async () => {
    const a = fakePorts();
    await prepareRekey(a.ports);
    a.fail.add("applyMarker");
    const stuck = await runRekey(a.ports, { confirmed: true });
    // Nałożenie znacznika się nie udało, ale ślad `markStarted` już jest — anulować nie wolno.
    expect(stuck.wait).toBe("error");
    expect(stuck.record).toMatchObject({ step: "seeded", markStarted: true });
    expect(canCancelRekey(stuck.record!)).toBe(false);
    expect(await cancelRekey(a.ports)).toBe(false);
    expect(a.state.record).not.toBeNull();

    const b = fakePorts();
    await prepareRekey(b.ports);
    b.fail.add("postMarker");
    b.fail.add("seedRoom");
    expect((await runRekey(b.ports, { confirmed: true })).record?.step).toBe("prepared");
    expect(await cancelRekey(b.ports)).toBe(true);
    expect(b.state.record).toBeNull();
    expect(b.log).toContain("dropRoom");
    expect(b.state.code).toBe("STARYKODAAAA");
  });

  it("błąd kroku zostaje w zapisie, a ponowienie powtarza ten sam krok", async () => {
    const { ports, log, fail } = fakePorts();
    await prepareRekey(ports);
    fail.add("postMarker");
    const first = await runRekey(ports, { confirmed: true });
    expect(first.wait).toBe("error");
    expect(first.record).toMatchObject({ step: "seeded", markTries: 1, error: { step: "seeded" } });
    expect(log).not.toContain("switchTo");
    fail.clear();
    log.length = 0;
    const second = await runRekey(ports);
    expect(second.record?.step).toBe("switched");
    expect(second.record?.error).toBeUndefined();
    expect(log).not.toContain("seedRoom");
  });

  it("znacznik da się pominąć dopiero po trzech nieudanych wysyłkach", async () => {
    const { ports, fail } = fakePorts();
    await prepareRekey(ports);
    fail.add("postMarker");
    let res = await runRekey(ports, { confirmed: true, skipMarker: true });
    expect(res.record?.step).toBe("seeded");
    expect(canSkipMarker(res.record!)).toBe(false);
    await runRekey(ports);
    res = await runRekey(ports);
    expect(canSkipMarker(res.record!)).toBe(true);
    res = await runRekey(ports, { skipMarker: true });
    expect(res.record).toMatchObject({ step: "switched", markerSkipped: true });
  });

  it("bez przekaźnika: kroki sieciowe są puste, a wymiana dochodzi do końca", async () => {
    const { ports, log, state } = fakePorts();
    state.relay = null;
    state.peers = 1;
    await prepareRekey(ports);
    const res = await runRekey(ports, { confirmed: true });
    expect(res.record).toMatchObject({ step: "done", oldCode: null });
    expect(log.filter((l) => l !== "save")).toEqual(["applyMarker", "wait", "switchTo", "forgetRoom"]);
  });

  it("wznowienie w kroku „marked” kończy przełączenie; kod już przełączony nie jest zapisywany drugi raz", async () => {
    const { ports, log, state } = fakePorts();
    await prepareRekey(ports);
    state.record = { ...state.record!, step: "marked", markStarted: true };
    await runRekey(ports);
    expect(state.code).toBe(state.record!.newCode);
    expect(log.filter((l) => l === "switchTo")).toHaveLength(1);

    // Karta zamknięta po zapisie ustawień, przed zapisem kroku.
    state.record = { ...state.record!, step: "marked" };
    log.length = 0;
    const res = await runRekey(ports);
    expect(res.record?.step).toBe("switched");
    expect(log).not.toContain("switchTo");
  });

  it("nieudany zapis kroku zatrzymuje wymianę przed następnym działaniem", async () => {
    const { ports, log, fail } = fakePorts();
    await prepareRekey(ports);
    fail.add("save");
    const res = await runRekey(ports, { confirmed: true });
    expect(res.wait).toBe("error");
    expect(log).toContain("seedRoom");
    expect(log).not.toContain("applyMarker");
  });

  it("pokój, do którego ktoś wciąż pisze: ponawia, a po 30 dniach kończy z błędem", async () => {
    const { ports, state } = fakePorts();
    await prepareRekey(ports);
    await runRekey(ports, { confirmed: true });
    state.retireOk = false;
    state.now += RETIRE_AFTER_MS;
    const res = await runRekey(ports);
    expect(res.wait).toBe("error");
    expect(res.record).toMatchObject({ step: "switched", retireTries: 1 });
    state.now += RETIRE_GIVE_UP_MS + 1;
    const end = await runRekey(ports);
    expect(end.record).toMatchObject({ step: "done", oldCode: null, error: { step: "switched" } });
  });

  it("druga karta nie wykonuje kroków", async () => {
    const { ports, log, state } = fakePorts();
    await prepareRekey(ports);
    state.busy = true;
    log.length = 0;
    expect((await runRekey(ports, { confirmed: true })).wait).toBe("busy");
    expect(await cancelRekey(ports)).toBe(false);
    expect(log).toEqual([]);
  });
});
