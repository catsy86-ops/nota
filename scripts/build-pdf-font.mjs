// Czcionka dokumentów PDF (`public/fonts/protokol-*.ttf`): Barlow Condensed 400 i 700 (OFL) z @fontsource,
// scalona z dwóch podzbiorów — `latin` (A–Z, cyfry, ó) i `latin-ext` (ą, ę, ł, ś, ż…). jsPDF przyjmuje tylko TTF
// i jedną czcionkę na napis, a @fontsource dzieli krój na podzbiory w WOFF. Wcześniej był tu sam `latin-ext`,
// więc w PDF-ach brakowało zwykłych liter i cyfr.
//
// Uruchomienie: `node scripts/build-pdf-font.mjs`. Bez zależności: WOFF 1.0 rozpakowuje `zlib`, scalanie dotyka
// tylko tablic, które czyta jsPDF (cmap, glyf, loca, hmtx, hhea, maxp, head, post, OS/2, name). GSUB/GPOS/GDEF
// odpadają — jsPDF ich nie używa.
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { join } from "node:path";

const SRC = "node_modules/@fontsource/barlow-condensed/files";
const OUT = "public/fonts";

function readWoff(path) {
  const b = readFileSync(path);
  if (b.toString("latin1", 0, 4) !== "wOFF") throw new Error(`${path}: to nie WOFF 1.0`);
  const n = b.readUInt16BE(12);
  const tables = new Map();
  for (let i = 0; i < n; i++) {
    const o = 44 + i * 20;
    const tag = b.toString("latin1", o, o + 4);
    const off = b.readUInt32BE(o + 4), comp = b.readUInt32BE(o + 8), orig = b.readUInt32BE(o + 12);
    const raw = b.subarray(off, off + comp);
    tables.set(tag, Buffer.from(comp < orig ? inflateSync(raw) : raw));
  }
  return tables;
}

function parseFont(t) {
  const head = t.get("head"), maxp = t.get("maxp"), hhea = t.get("hhea"), hmtx = t.get("hmtx"), loca = t.get("loca"), glyf = t.get("glyf");
  const numGlyphs = maxp.readUInt16BE(4);
  const longLoca = head.readInt16BE(50) === 1;
  const off = (i) => (longLoca ? loca.readUInt32BE(i * 4) : loca.readUInt16BE(i * 2) * 2);
  const glyphs = [];
  for (let i = 0; i < numGlyphs; i++) glyphs.push(Buffer.from(glyf.subarray(off(i), off(i + 1))));
  const nHM = hhea.readUInt16BE(34);
  const metrics = [];
  for (let i = 0; i < numGlyphs; i++) {
    if (i < nHM) metrics.push([hmtx.readUInt16BE(i * 4), hmtx.readInt16BE(i * 4 + 2)]);
    else metrics.push([metrics[nHM - 1][0], hmtx.readInt16BE(nHM * 4 + (i - nHM) * 2)]);
  }
  return { t, glyphs, metrics, cmap: parseCmap(t.get("cmap")), unitsPerEm: head.readUInt16BE(18) };
}

/** Znak → glif z podtablicy Unicode (format 4 albo 12). */
function parseCmap(c) {
  const map = new Map();
  const n = c.readUInt16BE(2);
  for (let i = 0; i < n; i++) {
    const pid = c.readUInt16BE(4 + i * 8), eid = c.readUInt16BE(6 + i * 8), o = c.readUInt32BE(8 + i * 8);
    if (!((pid === 3 && (eid === 1 || eid === 10)) || pid === 0)) continue;
    const fmt = c.readUInt16BE(o);
    if (fmt === 4) {
      const seg = c.readUInt16BE(o + 6) / 2;
      const ends = o + 14, starts = ends + seg * 2 + 2, deltas = starts + seg * 2, ranges = deltas + seg * 2;
      for (let s = 0; s < seg; s++) {
        const end = c.readUInt16BE(ends + s * 2), start = c.readUInt16BE(starts + s * 2);
        const delta = c.readInt16BE(deltas + s * 2), ro = c.readUInt16BE(ranges + s * 2);
        for (let code = start; code <= end && code !== 0xffff; code++) {
          let g;
          if (ro === 0) g = (code + delta) & 0xffff;
          else {
            g = c.readUInt16BE(ranges + s * 2 + ro + (code - start) * 2);
            if (g !== 0) g = (g + delta) & 0xffff;
          }
          if (g !== 0) map.set(code, g);
        }
      }
    } else if (fmt === 12) {
      const groups = c.readUInt32BE(o + 12);
      for (let g = 0; g < groups; g++) {
        const s = c.readUInt32BE(o + 16 + g * 12), e = c.readUInt32BE(o + 20 + g * 12), first = c.readUInt32BE(o + 24 + g * 12);
        for (let code = s; code <= e; code++) map.set(code, first + code - s);
      }
    }
  }
  return map;
}

/** Indeksy glifów, do których odwołuje się glif złożony. */
function components(glyph) {
  if (glyph.length < 10 || glyph.readInt16BE(0) >= 0) return [];
  const out = [];
  let p = 10, flags;
  do {
    flags = glyph.readUInt16BE(p);
    out.push({ at: p + 2, index: glyph.readUInt16BE(p + 2) });
    p += 4 + (flags & 0x1 ? 4 : 2);
    if (flags & 0x8) p += 2; else if (flags & 0x40) p += 4; else if (flags & 0x80) p += 8;
  } while (flags & 0x20);
  return out;
}

function merge(base, ext) {
  if (base.unitsPerEm !== ext.unitsPerEm) throw new Error("różne unitsPerEm");
  const glyphs = base.glyphs.map((g) => Buffer.from(g));
  const metrics = [...base.metrics];
  const cmap = new Map(base.cmap);
  const remap = new Map();
  const take = (i) => {
    if (remap.has(i)) return remap.get(i);
    const copy = Buffer.from(ext.glyphs[i]);
    const ni = glyphs.length;
    remap.set(i, ni);
    glyphs.push(copy);
    metrics.push(ext.metrics[i]);
    for (const c of components(copy)) copy.writeUInt16BE(take(c.index), c.at);
    return ni;
  };
  for (const [code, g] of ext.cmap) if (!cmap.has(code)) cmap.set(code, take(g));
  return { glyphs, metrics, cmap };
}

function buildCmap(map) {
  const codes = [...map.keys()].filter((c) => c < 0xffff).sort((a, b) => a - b);
  const segs = [];
  for (const c of codes) {
    const last = segs[segs.length - 1];
    if (last && c === last.end + 1 && map.get(c) === map.get(last.end) + 1) last.end = c;
    else segs.push({ start: c, end: c, delta: (map.get(c) - c) & 0xffff });
  }
  segs.push({ start: 0xffff, end: 0xffff, delta: 1 });
  const n = segs.length;
  const len = 16 + n * 8;
  const sub = Buffer.alloc(len);
  const pow = 2 ** Math.floor(Math.log2(n));
  sub.writeUInt16BE(4, 0); sub.writeUInt16BE(len, 2); sub.writeUInt16BE(0, 4);
  sub.writeUInt16BE(n * 2, 6); sub.writeUInt16BE(pow * 2, 8); sub.writeUInt16BE(Math.log2(pow), 10); sub.writeUInt16BE(n * 2 - pow * 2, 12);
  segs.forEach((s, i) => {
    sub.writeUInt16BE(s.end, 14 + i * 2);
    sub.writeUInt16BE(s.start, 16 + n * 2 + i * 2);
    sub.writeUInt16BE(s.delta, 16 + n * 4 + i * 2);
    sub.writeUInt16BE(0, 16 + n * 6 + i * 2);
  });
  const head = Buffer.alloc(12);
  head.writeUInt16BE(0, 0); head.writeUInt16BE(1, 2);
  head.writeUInt16BE(3, 4); head.writeUInt16BE(1, 6); head.writeUInt32BE(12, 8);
  return Buffer.concat([head, sub]);
}

const pad4 = (b) => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4))]) : b);
function checksum(b) {
  const p = pad4(b);
  let s = 0;
  for (let i = 0; i < p.length; i += 4) s = (s + p.readUInt32BE(i)) >>> 0;
  return s;
}

function writeTtf(base, ext, m) {
  const t = new Map();
  const n = m.glyphs.length;
  // glyf + loca (długie przesunięcia)
  const parts = [];
  const loca = Buffer.alloc((n + 1) * 4);
  let pos = 0;
  m.glyphs.forEach((g, i) => { loca.writeUInt32BE(pos, i * 4); const p = pad4(g); parts.push(p); pos += p.length; });
  loca.writeUInt32BE(pos, n * 4);
  t.set("glyf", Buffer.concat(parts));
  t.set("loca", loca);
  const hmtx = Buffer.alloc(n * 4);
  m.metrics.forEach(([adv, lsb], i) => { hmtx.writeUInt16BE(adv, i * 4); hmtx.writeInt16BE(lsb, i * 4 + 2); });
  t.set("hmtx", hmtx);
  const hhea = Buffer.from(base.t.get("hhea"));
  hhea.writeUInt16BE(n, 34);
  hhea.writeUInt16BE(Math.max(...m.metrics.map(([a]) => a)), 10);
  t.set("hhea", hhea);
  const maxp = Buffer.from(base.t.get("maxp"));
  const em = ext.t.get("maxp");
  for (let o = 6; o + 2 <= maxp.length && o + 2 <= em.length; o += 2) maxp.writeUInt16BE(Math.max(maxp.readUInt16BE(o), em.readUInt16BE(o)), o);
  maxp.writeUInt16BE(n, 4);
  t.set("maxp", maxp);
  const head = Buffer.from(base.t.get("head"));
  const eh = ext.t.get("head");
  head.writeInt16BE(Math.min(head.readInt16BE(36), eh.readInt16BE(36)), 36);
  head.writeInt16BE(Math.min(head.readInt16BE(38), eh.readInt16BE(38)), 38);
  head.writeInt16BE(Math.max(head.readInt16BE(40), eh.readInt16BE(40)), 40);
  head.writeInt16BE(Math.max(head.readInt16BE(42), eh.readInt16BE(42)), 42);
  head.writeInt16BE(1, 50);
  head.writeUInt32BE(0, 8);
  t.set("head", head);
  t.set("cmap", buildCmap(m.cmap));
  const post = Buffer.from(base.t.get("post").subarray(0, 32));
  post.writeUInt32BE(0x00030000, 0);
  t.set("post", post);
  const os2 = Buffer.from(base.t.get("OS/2"));
  const codes = [...m.cmap.keys()].filter((c) => c < 0xffff);
  os2.writeUInt16BE(Math.min(...codes), 64);
  os2.writeUInt16BE(Math.max(...codes), 66);
  t.set("OS/2", os2);
  for (const tag of ["name", "gasp", "cvt ", "fpgm", "prep"]) if (base.t.has(tag)) t.set(tag, base.t.get(tag));

  const tags = [...t.keys()].sort();
  const num = tags.length;
  const pow = 2 ** Math.floor(Math.log2(num));
  const header = Buffer.alloc(12 + num * 16);
  header.writeUInt32BE(0x00010000, 0); header.writeUInt16BE(num, 4);
  header.writeUInt16BE(pow * 16, 6); header.writeUInt16BE(Math.log2(pow), 8); header.writeUInt16BE(num * 16 - pow * 16, 10);
  let offset = header.length;
  const bodies = [];
  tags.forEach((tag, i) => {
    const data = t.get(tag);
    const r = 12 + i * 16;
    header.write(tag, r, 4, "latin1");
    header.writeUInt32BE(checksum(data), r + 4);
    header.writeUInt32BE(offset, r + 8);
    header.writeUInt32BE(data.length, r + 12);
    const p = pad4(data);
    bodies.push(p);
    offset += p.length;
  });
  const font = Buffer.concat([header, ...bodies]);
  const headAt = header.readUInt32BE(12 + tags.indexOf("head") * 16 + 8);
  font.writeUInt32BE((0xb1b0afba - checksum(font)) >>> 0, headAt + 8);
  return font;
}

for (const [weight, name] of [[400, "regular"], [700, "bold"]]) {
  const base = parseFont(readWoff(join(SRC, `barlow-condensed-latin-${weight}-normal.woff`)));
  const ext = parseFont(readWoff(join(SRC, `barlow-condensed-latin-ext-${weight}-normal.woff`)));
  const merged = merge(base, ext);
  const font = writeTtf(base, ext, merged);
  writeFileSync(join(OUT, `protokol-${name}.ttf`), font);
  console.log(`protokol-${name}.ttf: ${merged.glyphs.length} glifów, ${merged.cmap.size} znaków, ${font.length} B`);
}
