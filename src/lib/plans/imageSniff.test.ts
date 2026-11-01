import { describe, expect, it } from "vitest";
import { checkPlanFile, sniffImage } from "./imageSniff";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? p.split("").map((c) => c.charCodeAt(0)) : p)));
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n: number) => [(n >> 8) & 255, n & 255];
const le24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];

const png = (w: number, h: number) => bytes([0x89], "PNG\r\n\x1a\n", u32(13), "IHDR", u32(w), u32(h), [8, 6, 0, 0, 0]);
// JPEG: SOI, APP0 (16 bajtów), SOF0 z wysokością i szerokością.
const jpeg = (w: number, h: number) => bytes([0xff, 0xd8, 0xff, 0xe0], u16(16), "JFIF\0", new Array(9).fill(0), [0xff, 0xc0], u16(17), [8], u16(h), u16(w), [3], new Array(9).fill(0));
const webpX = (w: number, h: number) => bytes("RIFF", [0, 0, 0, 0], "WEBP", "VP8X", u32(10).reverse(), [0, 0, 0, 0], le24(w - 1), le24(h - 1));

describe("rozpoznanie obrazu planu po bajtach", () => {
  it("PNG, JPEG i WebP (VP8X) z wymiarami z nagłówka", () => {
    expect(sniffImage(png(1920, 1080))).toEqual({ type: "image/png", w: 1920, h: 1080 });
    expect(sniffImage(jpeg(3000, 2000))).toEqual({ type: "image/jpeg", w: 3000, h: 2000 });
    expect(sniffImage(webpX(4096, 2304))).toEqual({ type: "image/webp", w: 4096, h: 2304 });
  });

  it("SVG, GIF i HTML udające obraz nie przechodzą", () => {
    expect(sniffImage(bytes("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"))).toBeNull();
    expect(sniffImage(bytes("GIF89a", new Array(20).fill(0)))).toBeNull();
    expect(sniffImage(bytes("<!doctype html><html>", new Array(20).fill(0)))).toBeNull();
  });

  it("limity: pusty, za duży plik, za duża rozdzielczość, zły typ", () => {
    expect(checkPlanFile(0, png(10, 10))).toEqual({ error: "empty" });
    expect(checkPlanFile(21 * 1024 * 1024, png(10, 10))).toEqual({ error: "tooBig" });
    expect(checkPlanFile(1000, png(13_000, 100))).toEqual({ error: "tooLarge" });
    expect(checkPlanFile(1000, png(8000, 8000))).toEqual({ error: "tooLarge" });
    expect(checkPlanFile(1000, bytes("hello world, not an image"))).toEqual({ error: "type" });
    expect(checkPlanFile(1000, png(1920, 1080))).toEqual({ ok: { type: "image/png", w: 1920, h: 1080 } });
  });
});
