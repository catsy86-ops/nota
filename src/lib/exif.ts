import { cleanGeo, type GeoPoint } from "@/lib/study/geo";

/**
 * Własny odczyt EXIF z JPEG (H4.3, decyzja H-8): tylko czas zrobienia i GPS, bez zależności.
 * Plik jest niezaufany — każdy odczyt sprawdza granice, liczba pól w katalogu jest ograniczona,
 * a błąd w strukturze daje pusty wynik zamiast wyjątku. HEIC i PNG: brak danych (czas z pliku).
 */

export interface ExifInfo {
  /** Moment zrobienia (ms). Bez strefy w pliku — czas lokalny tego urządzenia. */
  taken?: number;
  geo?: GeoPoint;
}

/** Tyle bajtów z początku pliku wystarcza na blok APP1 (EXIF ma limit 64 KB). */
export const EXIF_READ_BYTES = 128 * 1024;
const MAX_ENTRIES = 256;
const GPS_DEFAULT_ACC = 50;

const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATE_ORIGINAL = 0x9003;
const TAG_DATE_DIGITIZED = 0x9004;
const TAG_OFFSET_ORIGINAL = 0x9011;

interface Tiff { v: DataView; le: boolean }
interface Entry { type: number; count: number; at: number }

/** Bajty z początku pliku → czas i GPS; `{}` = brak EXIF albo uszkodzony. */
export function readExif(buf: Uint8Array): ExifInfo {
  try {
    const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    if (buf.length < 4 || v.getUint16(0) !== 0xffd8) return {};
    let p = 2;
    while (p + 4 <= buf.length) {
      if (buf[p] !== 0xff) return {};
      const marker = buf[p + 1];
      if (marker === 0xff) { p++; continue; }
      if (marker === 0xda || marker === 0xd9) return {};
      const len = v.getUint16(p + 2);
      if (len < 2) return {};
      // „Exif\0\0”
      if (marker === 0xe1 && p + 10 <= buf.length && v.getUint32(p + 4) === 0x45786966 && v.getUint16(p + 8) === 0) {
        const start = p + 10;
        const end = Math.min(buf.length, p + 2 + len);
        return parseTiff(new DataView(buf.buffer, buf.byteOffset + start, end - start));
      }
      p += 2 + len;
    }
  } catch {
    // Uszkodzony plik — bez danych.
  }
  return {};
}

function parseTiff(v: DataView): ExifInfo {
  if (v.byteLength < 8) return {};
  const order = v.getUint16(0);
  if (order !== 0x4949 && order !== 0x4d4d) return {};
  const t: Tiff = { v, le: order === 0x4949 };
  if (u16(t, 2) !== 42) return {};
  const ifd0 = readIfd(t, u32(t, 4));
  const out: ExifInfo = {};
  const exifAt = ifd0.get(TAG_EXIF_IFD);
  if (exifAt) {
    const exif = readIfd(t, u32(t, exifAt.at));
    const raw = ascii(t, exif.get(TAG_DATE_ORIGINAL)) ?? ascii(t, exif.get(TAG_DATE_DIGITIZED));
    const taken = raw ? parseExifDate(raw, ascii(t, exif.get(TAG_OFFSET_ORIGINAL))) : undefined;
    if (taken !== undefined) out.taken = taken;
  }
  const gpsAt = ifd0.get(TAG_GPS_IFD);
  if (gpsAt) {
    const gps = readIfd(t, u32(t, gpsAt.at));
    const lat = degrees(t, gps.get(2));
    const lng = degrees(t, gps.get(4));
    if (lat !== undefined && lng !== undefined && (lat !== 0 || lng !== 0)) {
      const sLat = ascii(t, gps.get(1)) === "S" ? -1 : 1;
      const sLng = ascii(t, gps.get(3)) === "W" ? -1 : 1;
      const err = rationals(t, gps.get(0x1f), 1)?.[0];
      const geo = cleanGeo({ lat: sLat * lat, lng: sLng * lng, acc: err !== undefined && err > 0 ? err : GPS_DEFAULT_ACC });
      if (geo) out.geo = geo;
    }
  }
  return out;
}

const u16 = (t: Tiff, at: number) => t.v.getUint16(at, t.le);
const u32 = (t: Tiff, at: number) => t.v.getUint32(at, t.le);

/** Katalog TIFF pod `off`: tag → typ, liczba i pozycja pola wartości. Poza plikiem → pusty. */
function readIfd(t: Tiff, off: number): Map<number, Entry> {
  const out = new Map<number, Entry>();
  if (off < 8 || off + 2 > t.v.byteLength) return out;
  const n = Math.min(u16(t, off), MAX_ENTRIES);
  for (let i = 0; i < n; i++) {
    const e = off + 2 + i * 12;
    if (e + 12 > t.v.byteLength) break;
    out.set(u16(t, e), { type: u16(t, e + 2), count: u32(t, e + 4), at: e + 8 });
  }
  return out;
}

/** Pozycja danych pola: do 4 bajtów w samym wpisie, dłuższe pod przesunięciem. */
function dataAt(t: Tiff, e: Entry, size: number): number | undefined {
  const at = size <= 4 ? e.at : u32(t, e.at);
  return at + size <= t.v.byteLength ? at : undefined;
}

function ascii(t: Tiff, e: Entry | undefined): string | undefined {
  if (!e || e.type !== 2 || e.count === 0 || e.count > 64) return undefined;
  const at = dataAt(t, e, e.count);
  if (at === undefined) return undefined;
  let s = "";
  for (let i = 0; i < e.count; i++) {
    const c = t.v.getUint8(at + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function rationals(t: Tiff, e: Entry | undefined, n: number): number[] | undefined {
  if (!e || e.type !== 5 || e.count < n) return undefined;
  const at = dataAt(t, e, n * 8);
  if (at === undefined) return undefined;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const den = u32(t, at + i * 8 + 4);
    if (den === 0) return undefined;
    out.push(u32(t, at + i * 8) / den);
  }
  return out;
}

function degrees(t: Tiff, e: Entry | undefined): number | undefined {
  const r = rationals(t, e, 3);
  return r ? r[0] + r[1] / 60 + r[2] / 3600 : undefined;
}

const DATE_RE = /^([0-9]{4}):([0-9]{2}):([0-9]{2})[ T]([0-9]{2}):([0-9]{2}):([0-9]{2})/;
const OFFSET_RE = /^([+-])([0-9]{2}):([0-9]{2})$/;

/**
 * „2026:10:14 07:40:12” → ms. Z przesunięciem („+02:00”, `OffsetTimeOriginal`) — dokładny moment,
 * bez niego czas lokalny urządzenia. Daty spoza 1990–2100 i niemożliwe pola → `undefined`.
 */
export function parseExifDate(raw: string, offset?: string): number | undefined {
  const m = DATE_RE.exec(raw);
  if (!m) return undefined;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  if (y < 1990 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return undefined;
  const o = offset ? OFFSET_RE.exec(offset) : null;
  if (o) {
    const shift = (Number(o[2]) * 60 + Number(o[3])) * 60_000 * (o[1] === "-" ? -1 : 1);
    return Date.UTC(y, mo - 1, d, h, mi, s) - shift;
  }
  return new Date(y, mo - 1, d, h, mi, s).getTime();
}
