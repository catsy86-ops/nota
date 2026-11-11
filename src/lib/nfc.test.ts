import { afterEach, describe, expect, it, vi } from "vitest";
import { hasNFC, readNFCTag, tagValue } from "./nfc";

const data = (s: string) => new DataView(new TextEncoder().encode(s).buffer);

afterEach(() => { delete (window as { NDEFReader?: unknown }).NDEFReader; vi.useRealTimers(); });

describe("tagValue", () => {
  it("rekord tekstowy bez obcinania pierwszego znaku (Web NFC daje dane bez bajtu flag)", () => {
    expect(tagValue({ message: { records: [{ recordType: "text", data: data("Kolano 16"), encoding: "utf-8" }] } })).toBe("Kolano 16");
  });
  it("adres z rekordu url, pierwszy użyteczny rekord, śmieci czyszczone", () => {
    expect(tagValue({ message: { records: [{ recordType: "mime", data: data("x") }, { recordType: "url", data: data(" https://x.pl/a\n") }] } })).toBe("https://x.pl/a");
  });
  it("tag bez danych NDEF: numer seryjny; zupełnie pusty: null", () => {
    expect(tagValue({ serialNumber: "04:aa:bb", message: { records: [] } })).toBe("04:aa:bb");
    expect(tagValue({ message: { records: [] } })).toBeNull();
    expect(tagValue({})).toBeNull();
  });
});

describe("readNFCTag", () => {
  it("bez NDEFReader: unsupported", async () => {
    expect(hasNFC()).toBe(false);
    expect(await readNFCTag()).toEqual({ ok: false, reason: "unsupported" });
  });

  it("zwraca wartość z pierwszego odczytu", async () => {
    class Reader { onreading: ((e: unknown) => void) | null = null; onreadingerror = null; async scan() { setTimeout(() => this.onreading?.({ serialNumber: "04:01" }), 0); } }
    (window as { NDEFReader?: unknown }).NDEFReader = Reader;
    expect(hasNFC()).toBe(true);
    expect(await readNFCTag()).toEqual({ ok: true, value: "04:01" });
  });

  it("odmowa zgody, przerwanie i limit czasu mają osobne powody", async () => {
    class Denied { onreading = null; onreadingerror = null; async scan() { throw Object.assign(new Error("x"), { name: "NotAllowedError" }); } }
    (window as { NDEFReader?: unknown }).NDEFReader = Denied;
    expect(await readNFCTag()).toEqual({ ok: false, reason: "denied" });

    class Silent { onreading = null; onreadingerror = null; async scan() { /* czeka na tag */ } }
    (window as { NDEFReader?: unknown }).NDEFReader = Silent;
    const c = new AbortController();
    const p = readNFCTag(c.signal);
    c.abort();
    expect(await p).toEqual({ ok: false, reason: "aborted" });

    vi.useFakeTimers();
    const t = readNFCTag(undefined, 1000);
    await vi.advanceTimersByTimeAsync(1001);
    expect(await t).toEqual({ ok: false, reason: "timeout" });
  });
});

describe("readNFCTag: pozostałe powody (T25)", () => {
  const withReader = (R: unknown) => { (window as { NDEFReader?: unknown }).NDEFReader = R; };

  it("błąd odczytu tagu i pusty tag dają „empty”", async () => {
    class Err { onreading = null; onreadingerror: (() => void) | null = null; async scan() { setTimeout(() => this.onreadingerror?.(), 0); } }
    withReader(Err);
    expect(await readNFCTag()).toEqual({ ok: false, reason: "empty" });
    class Empty { onreading: ((e: unknown) => void) | null = null; onreadingerror = null; async scan() { setTimeout(() => this.onreading?.({ message: { records: [] } }), 0); } }
    withReader(Empty);
    expect(await readNFCTag()).toEqual({ ok: false, reason: "empty" });
  });

  it("nieznany wyjątek ze scan to „error”, AbortError to „aborted”", async () => {
    class Boom { onreading = null; onreadingerror = null; async scan() { throw new Error("coś"); } }
    withReader(Boom);
    expect(await readNFCTag()).toEqual({ ok: false, reason: "error" });
    class Abort { onreading = null; onreadingerror = null; async scan() { throw Object.assign(new Error("x"), { name: "AbortError" }); } }
    withReader(Abort);
    expect(await readNFCTag()).toEqual({ ok: false, reason: "aborted" });
  });

  it("po udanym odczycie późniejsze przerwanie nie zmienia wyniku", async () => {
    class Once { onreading: ((e: unknown) => void) | null = null; onreadingerror = null; async scan() { setTimeout(() => this.onreading?.({ serialNumber: "04:07" }), 0); } }
    withReader(Once);
    const c = new AbortController();
    const result = await readNFCTag(c.signal);
    c.abort();
    expect(result).toEqual({ ok: true, value: "04:07" });
  });
});

describe("readNFCTag: limit czasu osobno", () => {
  it("bez tagu przez limit: „timeout”", async () => {
    class Silent2 { onreading = null; onreadingerror = null; async scan() { /* czeka */ } }
    (window as { NDEFReader?: unknown }).NDEFReader = Silent2;
    vi.useFakeTimers();
    const t = readNFCTag(undefined, 500);
    await vi.advanceTimersByTimeAsync(501);
    expect(await t).toEqual({ ok: false, reason: "timeout" });
  });
});
