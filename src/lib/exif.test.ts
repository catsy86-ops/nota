import { describe, expect, it } from "vitest";
import { parseExifDate, readExif } from "./exif";

type Enc = (le: boolean) => number[];
interface Field { tag: number; type: number; count: number; bytes: Enc }

const n16 = (v: number, le: boolean) => (le ? [v & 255, (v >> 8) & 255] : [(v >> 8) & 255, v & 255]);
const n32 = (v: number, le: boolean) => (le ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255] : [(v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255]);
const ascii = (tag: number, s: string): Field => ({ tag, type: 2, count: s.length + 1, bytes: () => [...s].map((c) => c.charCodeAt(0)).concat(0) });
const rational = (tag: number, parts: [number, number][]): Field => ({ tag, type: 5, count: parts.length, bytes: (le) => parts.flatMap(([a, b]) => [...n32(a, le), ...n32(b, le)]) });

/** TIFF z katalogiem 0 (wskaźniki EXIF i GPS) oraz katalogami EXIF i GPS. */
function tiff(le: boolean, exif: Field[], gps: Field[] | null): number[] {
  const out: number[] = [...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...n16(42, le), ...n32(8, le)];
  const set32 = (pos: number, v: number) => { out.splice(pos, 4, ...n32(v, le)); };
  const ifd = (fields: Field[]) => {
    const start = out.length;
    out.push(...n16(fields.length, le));
    const later: [number, number[]][] = [];
    for (const f of fields) {
      out.push(...n16(f.tag, le), ...n16(f.type, le), ...n32(f.count, le));
      const data = f.bytes(le);
      if (data.length <= 4) out.push(...data, ...Array(4 - data.length).fill(0));
      else { later.push([out.length, data]); out.push(0, 0, 0, 0); }
    }
    out.push(0, 0, 0, 0);
    for (const [pos, data] of later) { set32(pos, out.length); out.push(...data); if (out.length % 2) out.push(0); }
    return start;
  };
  const pointers: Field[] = [{ tag: 0x8769, type: 4, count: 1, bytes: () => [0, 0, 0, 0] }];
  if (gps) pointers.push({ tag: 0x8825, type: 4, count: 1, bytes: () => [0, 0, 0, 0] });
  ifd(pointers);
  set32(8 + 2 + 8, ifd(exif));
  if (gps) set32(8 + 2 + 12 + 8, ifd(gps));
  return out;
}

function jpeg(body: number[]): Uint8Array {
  const len = 2 + 6 + body.length;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xe1, len >> 8, len & 255, 0x45, 0x78, 0x69, 0x66, 0, 0, ...body, 0xff, 0xda, 0, 2]);
}

const GPS = [
  ascii(1, "N"), rational(2, [[50, 1], [3, 1], [3600, 100]]),
  ascii(3, "E"), rational(4, [[19, 1], [56, 1], [0, 1]]),
];

describe("readExif", () => {
  for (const le of [true, false]) {
    it(`czas z przesunięciem i GPS (${le ? "Intel" : "Motorola"})`, () => {
      const r = readExif(jpeg(tiff(le, [ascii(0x9003, "2026:10:14 07:40:12"), ascii(0x9011, "+02:00")], GPS)));
      expect(r.taken).toBe(Date.UTC(2026, 9, 14, 5, 40, 12));
      expect(r.geo).toEqual({ lat: 50.06, lng: 19.93333, acc: 50 });
    });
  }

  it("bez przesunięcia — czas lokalny; bez GPS — brak lokalizacji", () => {
    const r = readExif(jpeg(tiff(true, [ascii(0x9003, "2026:10:14 07:40:12")], null)));
    expect(r.taken).toBe(new Date(2026, 9, 14, 7, 40, 12).getTime());
    expect(r.geo).toBeUndefined();
  });

  it("GPS 0,0 i zerowy mianownik to brak lokalizacji", () => {
    const zero = [ascii(1, "N"), rational(2, [[0, 1], [0, 1], [0, 1]]), ascii(3, "E"), rational(4, [[0, 1], [0, 1], [0, 1]])];
    expect(readExif(jpeg(tiff(true, [], zero))).geo).toBeUndefined();
    const den = [ascii(1, "N"), rational(2, [[50, 0], [0, 1], [0, 1]]), ascii(3, "E"), rational(4, [[19, 1], [0, 1], [0, 1]])];
    expect(readExif(jpeg(tiff(true, [], den))).geo).toBeUndefined();
  });

  it("nie JPEG, ucięty plik i śmieci dają pusty wynik bez wyjątku", () => {
    expect(readExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toEqual({});
    const full = jpeg(tiff(true, [ascii(0x9003, "2026:10:14 07:40:12")], GPS));
    for (let cut = 0; cut < full.length; cut += 7) expect(() => readExif(full.subarray(0, cut))).not.toThrow();
    const noisy = full.slice();
    for (let i = 20; i < noisy.length; i += 3) noisy[i] = 0xff;
    expect(() => readExif(noisy)).not.toThrow();
  });
});

describe("parseExifDate", () => {
  it("odrzuca niemożliwe daty", () => {
    expect(parseExifDate("0000:00:00 00:00:00")).toBeUndefined();
    expect(parseExifDate("2026:13:01 10:00:00")).toBeUndefined();
    expect(parseExifDate("coś")).toBeUndefined();
  });

  it("przesunięcie ujemne", () => {
    expect(parseExifDate("2026:10:14 07:40:12", "-05:00")).toBe(Date.UTC(2026, 9, 14, 12, 40, 12));
  });
});
