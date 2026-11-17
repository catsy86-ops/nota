import { beforeEach, describe, expect, it } from "vitest";
import {
  encodeSnapshot, listDailySnapshots, parseSnapshot, readSnapshotStatus, snapshotFileName, takeDailySnapshot, unpinDailySnapshot,
  SNAPSHOT_DIR, SNAPSHOT_KEEP, SNAPSHOT_LAST_KEY, type SnapshotEnv, type SnapshotSource,
} from "./dailySnapshot";

// Z-16.1 część A (`docs/plan-dane-lokalne.md` §1.3–1.4): kopie dzienne w OPFS — atrapa katalogu zamiast przeglądarki.

const notFound = () => new DOMException("brak", "NotFoundError");

class FakeDir {
  files = new Map<string, Uint8Array>();
  dirs = new Map<string, FakeDir>();
  async getDirectoryHandle(name: string, opts?: { create?: boolean }) {
    if (!this.dirs.has(name)) {
      if (!opts?.create) throw notFound();
      this.dirs.set(name, new FakeDir());
    }
    return this.dirs.get(name)!;
  }
  async getFileHandle(name: string, opts?: { create?: boolean }) {
    if (!this.files.has(name)) {
      if (!opts?.create) throw notFound();
      this.files.set(name, new Uint8Array());
    }
    return {
      getFile: async () => {
        const b = this.files.get(name);
        if (!b) throw notFound();
        const copy = b.slice();
        return { size: copy.length, arrayBuffer: async () => copy.buffer };
      },
    };
  }
  async removeEntry(name: string) {
    if (!this.files.delete(name)) throw notFound();
  }
  async *keys() {
    for (const k of [...this.files.keys()]) yield k;
  }
}

const enc = new TextEncoder();
let root: FakeDir;
let now: Date;
/** Ile najbliższych zapisów ma skończyć się brakiem miejsca. */
let quotaFails: number;
let held: boolean;
const removed: string[] = [];

const env = (): SnapshotEnv => ({
  root: async () => root as unknown as FileSystemDirectoryHandle,
  now: () => now,
  write: async (dir, name, bytes) => {
    if (quotaFails > 0) {
      quotaFails--;
      throw new DOMException("pełno", "QuotaExceededError");
    }
    (dir as unknown as FakeDir).files.set(name, bytes.slice());
  },
  // Blokada jak `withLockIfFree`: zajęta → null bez czekania.
  lock: async (fn) => {
    if (held) return null;
    held = true;
    try { return await fn(); } finally { held = false; }
  },
  lockWait: (fn) => fn(),
});

const source = (state: string, notes: number): SnapshotSource => ({
  encode: () => enc.encode(state),
  stateVector: () => enc.encode(`sv-${state}`),
  notes: () => notes,
});

const dir = () => root.dirs.get(SNAPSHOT_DIR)!;
const files = () => [...dir().files.keys()].filter((f) => f.endsWith(".nkopia")).sort();
const day = (d: number) => new Date(2026, 10, d, 9, 0);

beforeEach(() => {
  root = new FakeDir();
  now = day(1);
  quotaFails = 0;
  held = false;
  removed.length = 0;
  localStorage.clear();
  const orig = FakeDir.prototype.removeEntry;
  FakeDir.prototype.removeEntry = async function (name: string) { removed.push(name); return orig.call(this, name); };
  return () => { FakeDir.prototype.removeEntry = orig; };
});

describe("format pliku", () => {
  it("nagłówek NKD1 z liczbą notatek, rozmiarem i skrótem; treść bez zmian", async () => {
    expect(await takeDailySnapshot(source("stan-1", 148), env())).toBe("written");
    const name = snapshotFileName(now);
    expect(name).toBe("2026-11-01.nkopia");
    const bytes = dir().files.get(name)!;
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe("NKD1");
    const parsed = await parseSnapshot(bytes);
    expect(parsed.state).toBe("ok");
    if (parsed.state !== "ok") return;
    expect(parsed.header).toMatchObject({ v: 1, notes: 148, bytes: 6, createdAt: now.getTime() });
    expect(parsed.header.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.header.sv).toMatch(/^[0-9a-f]{64}$/);
    expect(new TextDecoder().decode(parsed.body)).toBe("stan-1");
    expect(JSON.parse(localStorage.getItem(SNAPSHOT_LAST_KEY)!)).toEqual({ date: now.getTime(), notes: 148 });
    expect(readSnapshotStatus()).toMatchObject({ result: "written" });
  });

  it("plik obcięty, z podmienionym bajtem albo bez magii jest uszkodzony; nowszy format — „newer”", async () => {
    const { bytes } = await encodeSnapshot(enc.encode("treść kopii"), { createdAt: 1, notes: 3, sv: "x" });
    expect((await parseSnapshot(bytes)).state).toBe("ok");
    expect((await parseSnapshot(bytes.subarray(0, bytes.length - 1))).state).toBe("broken");
    const flipped = bytes.slice();
    flipped[flipped.length - 1] ^= 1;
    expect((await parseSnapshot(flipped)).state).toBe("broken");
    expect((await parseSnapshot(enc.encode("XXXX0000"))).state).toBe("broken");
    expect((await parseSnapshot(new Uint8Array(3))).state).toBe("broken");

    const head = enc.encode(JSON.stringify({ v: 2, createdAt: 1, notes: 1, bytes: 0, sha256: "", sv: "" }));
    const newer = new Uint8Array(8 + head.length);
    newer.set(enc.encode("NKD1"));
    new DataView(newer.buffer).setUint32(4, head.length);
    newer.set(head, 8);
    expect((await parseSnapshot(newer)).state).toBe("newer");
  });

  it("lista pokazuje uszkodzony plik jako „broken”", async () => {
    await takeDailySnapshot(source("a", 5), env());
    const name = snapshotFileName(now);
    dir().files.set(name, dir().files.get(name)!.subarray(0, 20));
    const list = await listDailySnapshots(env());
    expect(list).toEqual([expect.objectContaining({ file: name, state: "broken" })]);
  });
});

describe("kiedy powstaje", () => {
  it("raz na dzień: druga próba tego samego dnia — „exists”", async () => {
    expect(await takeDailySnapshot(source("a", 1), env())).toBe("written");
    expect(await takeDailySnapshot(source("b", 1), env())).toBe("exists");
    expect(files()).toEqual(["2026-11-01.nkopia"]);
  });

  it("dzień bez zmian jest pomijany", async () => {
    await takeDailySnapshot(source("ten-sam", 1), env());
    now = day(2);
    expect(await takeDailySnapshot(source("ten-sam", 1), env())).toBe("unchanged");
    expect(files()).toEqual(["2026-11-01.nkopia"]);
  });

  it("uszkodzony dzisiejszy plik (przerwany zapis) jest zastępowany", async () => {
    await root.getDirectoryHandle(SNAPSHOT_DIR, { create: true });
    dir().files.set(snapshotFileName(now), enc.encode("NKD1śmieci"));
    expect(await takeDailySnapshot(source("a", 1), env())).toBe("written");
    expect((await listDailySnapshots(env()))![0].state).toBe("ok");
  });

  it("dwie karty naraz — jedna migawka", async () => {
    const results = await Promise.all([takeDailySnapshot(source("a", 1), env()), takeDailySnapshot(source("a", 1), env())]);
    expect(results.sort()).toEqual(["busy", "written"]);
    expect(files()).toHaveLength(1);
  });

  it("bez OPFS — „unsupported”, lista null", async () => {
    const none: SnapshotEnv = { ...env(), root: async () => null };
    expect(await takeDailySnapshot(source("a", 1), none)).toBe("unsupported");
    expect(await listDailySnapshots(none)).toBeNull();
    const throwing: SnapshotEnv = { ...env(), root: async () => { throw new DOMException("prywatny", "SecurityError"); } };
    expect(await takeDailySnapshot(source("a", 1), throwing)).toBe("unsupported");
  });
});

describe("rotacja i przypinanie", () => {
  it(`zostaje ${SNAPSHOT_KEEP} najnowszych`, async () => {
    for (let d = 1; d <= 10; d++) {
      now = day(d);
      expect(await takeDailySnapshot(source(`stan-${d}`, 30), env())).toBe("written");
    }
    expect(files()).toEqual(Array.from({ length: SNAPSHOT_KEEP }, (_, i) => snapshotFileName(day(4 + i))));
  });

  it("spadek liczby notatek o ponad połowę przypina poprzednią; przypięta przeżywa rotację", async () => {
    await takeDailySnapshot(source("pełny", 100), env());
    now = day(2);
    await takeDailySnapshot(source("pusty", 10), env());
    expect((await listDailySnapshots(env()))!.find((e) => e.file === "2026-11-01.nkopia")?.pinned).toBe(true);
    for (let d = 3; d <= 12; d++) {
      now = day(d);
      await takeDailySnapshot(source(`stan-${d}`, 10), env());
    }
    expect(files()).toContain("2026-11-01.nkopia");
    expect(files()).toHaveLength(SNAPSHOT_KEEP + 1);
  });

  it("poniżej progu 20 notatek nic się nie przypina", async () => {
    await takeDailySnapshot(source("a", 19), env());
    now = day(2);
    await takeDailySnapshot(source("b", 1), env());
    expect((await listDailySnapshots(env()))!.some((e) => e.pinned)).toBe(false);
  });

  it("nowsza przypięta zastępuje starszą; odpięta wraca do rotacji", async () => {
    await takeDailySnapshot(source("a", 100), env());
    now = day(2);
    await takeDailySnapshot(source("b", 40), env());
    now = day(3);
    await takeDailySnapshot(source("c", 10), env());
    const list = (await listDailySnapshots(env()))!;
    expect(list.filter((e) => e.pinned).map((e) => e.file)).toEqual(["2026-11-02.nkopia"]);
    await unpinDailySnapshot(env());
    expect((await listDailySnapshots(env()))!.some((e) => e.pinned)).toBe(false);
  });
});

describe("przypadki z przeglądu", () => {
  it("w trakcie przywracania/importu (wymiana porcjami) kopii nie ma — „busy”, bez pliku", async () => {
    expect(await takeDailySnapshot({ ...source("pośredni", 300), busy: () => true }, env())).toBe("busy");
    expect(files()).toEqual([]);
    expect(readSnapshotStatus()).toBeNull();
  });

  it("plik nowszej wersji aplikacji nie wypada przy rotacji", async () => {
    await root.getDirectoryHandle(SNAPSHOT_DIR, { create: true });
    const head = enc.encode(JSON.stringify({ v: 9, createdAt: day(1).getTime(), notes: 1, bytes: 0, sha256: "", sv: "" }));
    const newer = new Uint8Array(8 + head.length);
    newer.set(enc.encode("NKD1"));
    new DataView(newer.buffer).setUint32(4, head.length);
    newer.set(head, 8);
    dir().files.set("2026-10-01.nkopia", newer);
    for (let d = 1; d <= 9; d++) {
      now = day(d);
      await takeDailySnapshot(source(`s${d}`, 3), env());
    }
    expect(files()).toContain("2026-10-01.nkopia");
    expect((await listDailySnapshots(env()))!.find((e) => e.file === "2026-10-01.nkopia")?.state).toBe("newer");
  });

  it("nieudany zapis indeksu: nic nie jest usuwane (przypięcie żyje tylko w indeksie)", async () => {
    for (let d = 1; d <= SNAPSHOT_KEEP; d++) {
      now = day(d);
      await takeDailySnapshot(source(`s${d}`, 3), env());
    }
    const e = env();
    const failing: SnapshotEnv = { ...e, write: async (dirH, name, bytes) => { if (name === "indeks.json") throw new Error("io"); return e.write(dirH, name, bytes); } };
    now = day(8);
    expect(await takeDailySnapshot(source("s8", 3), failing)).toBe("written");
    expect(files()).toHaveLength(SNAPSHOT_KEEP + 1);
  });

  it("brak miejsca nie usuwa kopii, która ma zostać przypięta, ani nie zdejmuje przypięcia", async () => {
    await takeDailySnapshot(source("pełny-1", 100), env());
    now = day(2);
    await takeDailySnapshot(source("po-stracie", 10), env()); // 1.11 przypięta
    now = day(3);
    await takeDailySnapshot(source("odbudowa", 60), env());
    now = day(4);
    quotaFails = 2;
    // Nowa (5 notatek) przypnie 3.11 — jedyna nieprzypięta poza nią to 2.11; ona może zniknąć, 3.11 nie.
    expect(await takeDailySnapshot(source("znowu-pusto", 5), env())).toBe("quota");
    expect(files()).toEqual(["2026-11-01.nkopia", "2026-11-03.nkopia"]);
    expect((await listDailySnapshots(env()))!.find((x) => x.pinned)?.file).toBe("2026-11-01.nkopia");
  });

  it("brak miejsca, a jedyna kopia do usunięcia to ta, która ma zostać przypięta — zostaje", async () => {
    await takeDailySnapshot(source("pełny", 100), env());
    now = day(2);
    quotaFails = 2;
    expect(await takeDailySnapshot(source("pusto", 10), env())).toBe("quota");
    expect(files()).toEqual(["2026-11-01.nkopia"]);
  });

  it("odpięcie zwraca true i zdejmuje przypięcie", async () => {
    await takeDailySnapshot(source("a", 100), env());
    now = day(2);
    await takeDailySnapshot(source("b", 1), env());
    expect(await unpinDailySnapshot(env())).toBe(true);
    expect((await listDailySnapshots(env()))!.some((x) => x.pinned)).toBe(false);
  });
});

describe("brak miejsca", () => {
  async function threeDays() {
    for (let d = 1; d <= 3; d++) {
      now = day(d);
      await takeDailySnapshot(source(`stan-${d}`, 5), env());
    }
    removed.length = 0;
    now = day(4);
  }

  it("usuwa tylko najstarszą i zapisuje za drugim razem", async () => {
    await threeDays();
    quotaFails = 1;
    expect(await takeDailySnapshot(source("stan-4", 5), env())).toBe("written");
    expect(files()).toEqual(["2026-11-02.nkopia", "2026-11-03.nkopia", "2026-11-04.nkopia"]);
  });

  it("druga porażka: dziś bez kopii, z dawnych znika tylko najstarsza, status „quota”", async () => {
    await threeDays();
    quotaFails = 2;
    expect(await takeDailySnapshot(source("stan-4", 5), env())).toBe("quota");
    expect(files()).toEqual(["2026-11-02.nkopia", "2026-11-03.nkopia"]);
    expect(removed.filter((f) => f !== "2026-11-04.nkopia")).toEqual(["2026-11-01.nkopia"]);
    expect(readSnapshotStatus()).toMatchObject({ result: "quota" });
  });
});
