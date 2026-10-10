import { IMPORT_LIMITS } from "./limits";
import { imageMimeFromName, looksLikeKeepHtml, parseKeepHtml, parseKeepJson } from "./keep";
import { countImageEmbeds, parseMarkdownNote } from "./markdown";
import type { ParsedNote, SourceFile } from "./types";

/** Notatka gotowa do zapisu: sparsowana + znalezione pliki obrazów. */
export interface PlannedNote extends ParsedNote {
  images: SourceFile[];
}

export interface ImportFailure { path: string; reason: string }

export interface ImportPlan {
  notes: PlannedNote[];
  /** Wszystkie etykiety z importowanych notatek. */
  labels: string[];
  /** Unikalne ścieżki folderów (z podkatalogów Markdown). */
  folders: string[][];
  imageCount: number;
  counts: {
    keep: number;
    markdown: number;
    /** Pominięte jako duplikat (w paczce albo w aplikacji) — też para JSON+HTML tej samej notatki Keep. */
    duplicates: number;
    /** Notatki z kosza Keep — nie są importowane. */
    trashed: number;
    empty: number;
    failed: number;
    /** Pliki innych typów (np. Labels.txt, audio). */
    ignored: number;
  };
  warnings: string[];
  failures: ImportFailure[];
}

/** Minimalny kształt notatki z aplikacji potrzebny do wykrywania duplikatów. */
export interface ExistingNoteLike {
  title: string;
  content: string;
  checklist: { text: string }[];
  createdAt: number;
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

function bodyKey(n: { title: string; content: string; checklist: { text: string }[] }): string {
  return JSON.stringify([squash(n.title), squash(n.content), n.checklist.map((c) => squash(c.text))]);
}

const dirOf = (path: string) => path.split("/").slice(0, -1);
const extOf = (name: string) => /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase() ?? "";
const stemOf = (path: string) => path.replace(/\.[^./]+$/, "").toLowerCase();

function isHidden(path: string): boolean {
  return path.split("/").some((seg) => seg.startsWith(".") || seg === "__MACOSX");
}

/** Notatka z czasem pochodzącym ze źródła (a nie z daty pliku) — wtedy czas wchodzi do klucza duplikatu. */
function timeKey(createdAt: number | null): number | null {
  return createdAt === null ? null : Math.floor(createdAt / 1000);
}

/**
 * Z listy źródeł robi plan importu — czysta logika, bez zapisu do bazy.
 * Pojedynczy uszkodzony plik trafia do `failures`, reszta idzie dalej.
 */
export async function buildImportPlan(sources: SourceFile[], existing: ExistingNoteLike[] = []): Promise<ImportPlan> {
  const plan: ImportPlan = {
    notes: [], labels: [], folders: [], imageCount: 0,
    counts: { keep: 0, markdown: 0, duplicates: 0, trashed: 0, empty: 0, failed: 0, ignored: 0 },
    warnings: [], failures: [],
  };

  const visible = sources.filter((s) => !isHidden(s.path));
  plan.counts.ignored += sources.length - visible.length;

  // Katalog główny (wybrany folder / korzeń ZIP) nie jest folderem notatek.
  const firstSegs = visible.map((s) => s.path.split("/")[0]);
  const stripRoot = visible.length > 0 && visible.every((s) => s.path.includes("/")) && firstSegs.every((f) => f === firstSegs[0]);

  const imagesByName = new Map<string, SourceFile[]>();
  for (const s of visible) {
    if (imageMimeFromName(s.name)) {
      const k = s.name.toLowerCase();
      const arr = imagesByName.get(k);
      if (arr) arr.push(s); else imagesByName.set(k, [s]);
    }
  }

  const jsonStems = new Set(visible.filter((s) => extOf(s.name) === "json").map((s) => stemOf(s.path)));
  const seenFull = new Set<string>();
  const seenBody = new Set<string>();
  for (const e of existing) {
    seenBody.add(bodyKey(e));
    seenFull.add(`${bodyKey(e)}|${timeKey(e.createdAt)}`);
  }

  let unresolvedAttachments = 0;
  let nonImageAttachments = 0;
  let mdImageEmbeds = 0;
  let nonKeepJson = 0;
  let nonKeepHtml = 0;
  let overLimit = false;

  for (const src of visible) {
    const ext = extOf(src.name);
    const isMd = ext === "md" || ext === "markdown";
    const isKeepish = ext === "json" || ext === "html" || ext === "htm";
    if (!isMd && !isKeepish) {
      if (!imageMimeFromName(src.name)) plan.counts.ignored++;
      continue;
    }
    if (plan.notes.length >= IMPORT_LIMITS.maxNotes) { overLimit = true; break; }
    if (src.size > IMPORT_LIMITS.maxNoteFileBytes) {
      plan.counts.failed++;
      plan.failures.push({ path: src.path, reason: `Plik jest zbyt duży (max ${IMPORT_LIMITS.maxNoteFileBytes / (1024 * 1024)} MB)` });
      continue;
    }
    // Takeout zapisuje każdą notatkę Keep dwa razy (.json i .html) — bierzemy JSON.
    if ((ext === "html" || ext === "htm") && jsonStems.has(stemOf(src.path))) {
      plan.counts.duplicates++;
      continue;
    }

    let parsed: ParsedNote | null;
    try {
      const text = await src.text();
      if (isMd) {
        const segs = dirOf(src.path);
        const rel = stripRoot ? segs.slice(1) : segs;
        const folderPath = rel.slice(0, IMPORT_LIMITS.maxFolderDepth);
        if (rel.length > IMPORT_LIMITS.maxFolderDepth) folderPath[IMPORT_LIMITS.maxFolderDepth - 1] = rel.slice(IMPORT_LIMITS.maxFolderDepth - 1).join(" / ");
        parsed = parseMarkdownNote(text, { path: src.path, lastModified: src.lastModified, folderPath });
        mdImageEmbeds += countImageEmbeds(text);
      } else if (ext === "json") {
        parsed = parseKeepJson(text, src.path);
        if (!parsed) { nonKeepJson++; continue; }
      } else {
        if (!looksLikeKeepHtml(text)) { nonKeepHtml++; continue; }
        parsed = parseKeepHtml(text, src.path);
        if (!parsed) { nonKeepHtml++; continue; }
      }
    } catch (err) {
      plan.counts.failed++;
      plan.failures.push({ path: src.path, reason: err instanceof Error && !(err instanceof SyntaxError) ? err.message : "Uszkodzony lub nieczytelny plik" });
      continue;
    }

    if (parsed.trashed) { plan.counts.trashed++; continue; }

    // Załączniki: tylko obrazy, których bajty faktycznie mamy w paczce.
    const images: SourceFile[] = [];
    for (const att of parsed.attachments) {
      const base = att.filePath.split("/").pop() ?? att.filePath;
      const isImage = !!imageMimeFromName(base) || att.mimeType.startsWith("image/");
      if (!isImage) { nonImageAttachments++; continue; }
      const candidates = imagesByName.get(base.toLowerCase()) ?? [];
      const noteDir = dirOf(src.path).join("/");
      const found = candidates.find((c) => dirOf(c.path).join("/") === noteDir) ?? candidates[0];
      if (!found) { unresolvedAttachments++; continue; }
      if (found.size > IMPORT_LIMITS.maxImageBytes) { unresolvedAttachments++; continue; }
      if (!images.includes(found)) images.push(found);
    }

    if (!parsed.title.trim() && !parsed.content.trim() && parsed.checklist.length === 0 && images.length === 0) {
      plan.counts.empty++;
      continue;
    }

    const fullKey = `${bodyKey(parsed)}|${timeKey(parsed.createdAt)}`;
    const body = bodyKey(parsed);
    const dup = parsed.createdAt === null ? seenBody.has(body) : seenFull.has(fullKey);
    if (dup) { plan.counts.duplicates++; continue; }
    seenBody.add(body);
    seenFull.add(fullKey);

    plan.notes.push({ ...parsed, images });
    if (parsed.origin === "keep") plan.counts.keep++; else plan.counts.markdown++;
  }

  const labels = new Set<string>();
  const folders = new Map<string, string[]>();
  let imageCount = 0;
  for (const n of plan.notes) {
    n.labels.forEach((l) => labels.add(l));
    if (n.folderPath.length) folders.set(n.folderPath.join("\u0000"), n.folderPath);
    imageCount += n.images.length;
  }
  plan.labels = [...labels].sort((a, b) => a.localeCompare(b));
  plan.folders = [...folders.values()].sort((a, b) => a.join("/").localeCompare(b.join("/")));
  plan.imageCount = imageCount;

  if (unresolvedAttachments) plan.warnings.push(`${unresolvedAttachments} załączników (obrazów) nie ma w wybranych plikach i zostanie pominiętych — wybierz cały folder Keep albo plik .zip z Takeout, aby je przenieść.`);
  if (nonImageAttachments) plan.warnings.push(`${nonImageAttachments} załączników innych niż obrazy (np. nagrania) nie da się zaimportować.`);
  if (mdImageEmbeds) plan.warnings.push(`${mdImageEmbeds} osadzonych obrazów w plikach Markdown nie zostanie przeniesionych (zostaje zapis w treści).`);
  if (nonKeepJson) plan.warnings.push(`${nonKeepJson} plików .json nie wygląda na notatki Google Keep i pominięto je.`);
  if (nonKeepHtml) plan.warnings.push(`${nonKeepHtml} plików .html nie wygląda na notatki Google Keep i pominięto je.`);
  if (overLimit) plan.warnings.push(`Limit ${IMPORT_LIMITS.maxNotes} notatek na jeden import — resztę pominięto.`);
  return plan;
}
