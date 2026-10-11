import { format } from "date-fns";
import type { Folder, Note } from "@/hooks/useNotes";

/**
 * Eksport notatek jako ZIP z osobnymi plikami `.md` (frontmatter zgodny z importem
 * z Obsidiana/Markdown — `import/markdown.ts`), więc da się je wczytać z powrotem.
 * Foldery notatek stają się katalogami. Obrazy i załączniki nie są dołączane
 * (to eksport tekstowy); notatki prywatne są pomijane — ich treść jest w szyfrogramie.
 */

const TEXT = new TextEncoder();

let CRC_TABLE: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry { name: string; data: Uint8Array }

/** Archiwum ZIP bez kompresji (metoda 0), nazwy w UTF-8. */
export function buildZip(entries: ZipEntry[], now: Date = new Date()): Uint8Array {
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const u16 = (v: number) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff]);
  const u32 = (v: number) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
  const cat = (...parts: Uint8Array[]) => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  };

  for (const e of entries) {
    const name = TEXT.encode(e.name);
    const crc = crc32(e.data);
    const flags = 0x0800; // nazwy UTF-8
    const local = cat(
      u32(0x04034b50), u16(20), u16(flags), u16(0), u16(dosTime), u16(dosDate),
      u32(crc), u32(e.data.length), u32(e.data.length), u16(name.length), u16(0), name,
    );
    chunks.push(local, e.data);
    central.push(cat(
      u32(0x02014b50), u16(20), u16(20), u16(flags), u16(0), u16(dosTime), u16(dosDate),
      u32(crc), u32(e.data.length), u32(e.data.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), name,
    ));
    offset += local.length + e.data.length;
  }

  const centralBytes = cat(...central);
  const end = cat(
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(centralBytes.length), u32(offset), u16(0),
  );
  return cat(...chunks, centralBytes, end);
}

/** Nazwa pliku/katalogu bez znaków zakazanych w systemach plików. */
export function safeFileName(raw: string, fallback = "Bez tytułu"): string {
  const cleaned = raw.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().replace(/^\.+/, "").slice(0, 80).trim();
  return cleaned || fallback;
}

const quote = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const stamp = (ms: number) => format(new Date(ms), "yyyy-MM-dd HH:mm");

/** Jedna notatka jako plik `.md`: frontmatter + treść + lista zadań na końcu. */
export function noteToMarkdownFile(note: Note): string {
  const fm: string[] = ["---"];
  if (note.title.trim()) fm.push(`title: ${quote(note.title.trim())}`);
  if (note.labels.length) fm.push(`tags: [${note.labels.map(quote).join(", ")}]`);
  fm.push(`created: ${stamp(note.createdAt)}`);
  fm.push(`updated: ${stamp(note.updatedAt)}`);
  if (note.reminder) fm.push(`reminder: ${stamp(note.reminder)}`);
  if (note.pinned) fm.push("pinned: true");
  if (note.icon) fm.push(`icon: ${quote(note.icon)}`);
  if (note.favorite) fm.push("favorite: true");
  fm.push("---", "");
  const body: string[] = [];
  if (note.content.trim()) body.push(note.content.trim());
  if (note.checklist.length) {
    if (body.length) body.push("");
    for (const i of note.checklist) body.push(`${i.indent ? "  " : ""}- [${i.checked ? "x" : " "}] ${i.text}`);
  }
  return fm.join("\n") + body.join("\n") + "\n";
}

export interface NotesZip { bytes: Uint8Array; count: number; skippedPrivate: number }

/** Archiwum z podanych notatek; foldery jako katalogi, powtórzone tytuły dostają numer. */
export function buildNotesZip(notes: Note[], folders: Folder[], now: Date = new Date()): NotesZip {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const pathOf = (id: string | null | undefined): string => {
    const parts: string[] = [];
    let cur = id ? byId.get(id) : undefined;
    for (let guard = 0; cur && guard < 20; guard++) {
      parts.unshift(safeFileName(cur.name, "Folder"));
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return parts.length ? `${parts.join("/")}/` : "";
  };

  const used = new Set<string>();
  const entries: ZipEntry[] = [];
  let skippedPrivate = 0;
  for (const n of notes) {
    if (n.locked) { skippedPrivate++; continue; }
    const dir = pathOf(n.folderId);
    const base = safeFileName(n.title || n.content.split("\n")[0] || "");
    let name = `${dir}${base}.md`;
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${dir}${base} (${i}).md`;
    used.add(name.toLowerCase());
    entries.push({ name, data: TEXT.encode(noteToMarkdownFile(n)) });
  }
  return { bytes: buildZip(entries, now), count: entries.length, skippedPrivate };
}

/** Pobranie archiwum jako pliku; potwierdza toastem i zwraca liczbę zapisanych notatek. */
export function downloadNotesZip(notes: Note[], folders: Folder[], filename: string): NotesZip {
  const zip = buildNotesZip(notes, folders);
  const url = URL.createObjectURL(new Blob([zip.bytes as unknown as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return zip;
}
