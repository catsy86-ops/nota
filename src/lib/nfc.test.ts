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
