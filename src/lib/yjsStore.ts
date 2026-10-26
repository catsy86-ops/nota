import * as Y from "yjs";
import { toast } from "sonner";
import { looksLikeVaultToken } from "@/lib/vault";
import { METADATA_IN_CIPHERTEXT_SCHEMA, writeFormatAllowed } from "@/lib/formatSchema";
import { applyTextEdit, captureTextBase, mapOffset, type TextBase } from "./yTextEdit";
import { IndexeddbPersistence } from "y-indexeddb";
import { trackPersistence } from "@/lib/saveStatus";
import { get as idbGet, del as idbDel, keys as idbKeys, getMany as idbGetMany } from "idb-keyval";
import { loadAll as loadLegacySnapshot } from "@/lib/notesStore";
import { hashImage } from "@/lib/imageHash";
import { normalizeAttachments, isAttachmentSyncable, type Attachment } from "@/lib/attachments";
import { imageStore as defaultImageStore, isDataUrl, type ImageStore } from "@/lib/imageStore";
import type { Note, Folder, ChecklistItem } from "@/hooks/useNotes";
import { logDiag } from "@/lib/diagnostics";
import { NOTE_COVERS } from "@/lib/noteLook";
import { cleanNoteProps, cleanPropDef, cleanPropDefs, type NoteProps, type PropDef } from "@/lib/noteProps";
import { mergeSpec, projectReminder, readSpec, REMINDER_FIELDS, specOf, type ReminderState } from "@/lib/reminderSpec";
import { fallbackRepeat } from "@/lib/reminderRepeat";
import { journalRefsIn } from "@/lib/study/journalRefs";
import { cleanLabelPath, isUnderLabel, renameLabelBranch } from "@/lib/labelTree";
import {
  NOTE_COLORS, PRIORITIES, REMINDER_REPEATS, REMOTE_LIMITS as LIM,
  safeBool, safeDailyDate, safeEnum, safeNullableNumber, safeNullableString, safeNumber,
  safeOptionalEnum, safeOptionalNumber, safePeriodKey, safeReminderDay, safeString, safeStringArray,
} from "@/lib/safeProjection";

/**
 * Yjs-backed store for notes/folders/labels — the data layer that will let a
 * future device-to-device sync (Yjs CRDT, y-webrtc) merge concurrent edits
 * field-by-field instead of whole-record last-write-wins. This module has no
 * network transport yet: it only replaces the old idb-keyval persistence
 * (`notesStore.ts`) with a Y.Doc persisted via `y-indexeddb`, one-time
 * migrated from whatever `notesStore.ts` already had on disk.
 *
 * Image bytes live OUTSIDE the Y.Doc, in the content-addressed `imageStore`
 * (key = SHA-256). The doc only carries the `imageHashes` manifest — a small
 * list of keys that syncs with the note — and that manifest IS `Note.images`
 * in the projection. Bytes travel separately (`imageSync.ts`, sync file, backup).
 */

/** Stare formaty obrazów (data URL-e per notatka) — tylko do migracji. */
const LEGACY_IMAGES_KEY = "kaczy.images.v1";
const IMAGES_PREFIX = "kaczy.images.v2:";

type YNote = Y.Map<unknown>;
type YFolder = Y.Map<unknown>;
type YChecklistItem = Y.Map<unknown>;
type ImagesById = Record<string, string[]>;
/** Wspólna pusta lista — stabilna tożsamość dla notatek bez obrazów. */
const NO_IMAGES: string[] = [];

/**
 * Do dokumentu trafiają wyłącznie klucze. Data URL tutaj to błąd wołającego
 * (powinien przejść przez `imageStore.ingest`) — wpisany do Y.Doc rozjechałby
 * się do wszystkich peerów jako megabajty base64.
 */
function imageRefs(images: string[]): string[] {
  if (!images.some(isDataUrl)) return images.slice();
  logDiag("error", "yjsStore", "data URL passed as an image ref — dropped (caller must ingest first)");
  return images.filter((img) => !isDataUrl(img));
}

/** Przypomnienie z dokumentu: `reminderSpec`, a gdy go nie ma — stare pola (notatki sprzed zmiany). */
function readReminderState(y: YNote): ReminderState {
  return projectReminder(readSpec(y.get("reminderSpec")), {
    reminder: safeNullableNumber(y.get("reminder")),
    reminderRepeat: safeOptionalEnum(y.get("reminderRepeat"), REMINDER_REPEATS),
    reminderDay: safeReminderDay(y.get("reminderDay")),
    reminderRepeatUntil: safeOptionalNumber(y.get("reminderRepeatUntil")),
  });
}

const NOTE_SCALAR_FIELDS = [
  "title", "color", "pinned", "archived", "trashed", "trashedAt",
  "labels", "aliases", "reminder", "reminderRepeat", "reminderDay", "reminderRepeatUntil", "priority", "dailyDate", "periodKey", "snoozedUntil",
  "icon", "cover", "favorite", "readOnly", "parentId", "wide", "largeText", "folderId", "order", "createdAt", "updatedAt",
] as const;

const FOLDER_SCALAR_FIELDS = [
  "name", "color", "emoji", "parentId", "order", "createdAt", "updatedAt",
] as const;

/**
 * Common-prefix/suffix diff so unrelated surrounding text keeps stable Yjs positions.
 * Tylko dla zapisów **bez** otwartej sesji edycji (import, szablony, duplikaty):
 * liczy diff od bieżącego stanu CRDT, więc nadpisałby współbieżne zmiany peera.
 * Edytor idzie przez `beginTextEdit` → `applyTextEdit` (patrz `yTextEdit.ts`).
 */
function applyTextDiff(ytext: Y.Text, next: string) {
  const prev = ytext.toString();
  if (prev === next) return;
  const maxStart = Math.min(prev.length, next.length);
  let start = 0;
  while (start < maxStart && prev[start] === next[start]) start++;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--; endNext--;
  }
  if (endPrev > start) ytext.delete(start, endPrev - start);
  if (endNext > start) ytext.insert(start, next.slice(start, endNext));
}

/** Checklist is a Y.Map keyed by item id (like notesMap/foldersMap) so concurrent
 *  edits to different items — or the same item's `checked`/`text` — merge
 *  field-by-field instead of one whole-array write clobbering the other.
 *  Item order is tracked via a per-item `order` field, same pattern as note order. */
function yChecklistFromPlain(items: ChecklistItem[] | undefined): Y.Map<YChecklistItem> {
  const map = new Y.Map<YChecklistItem>();
  // Stare kopie i importy bywają bez pola `checklist` — bez tej osłony migracja wywracała start (pusta aplikacja).
  (items ?? []).forEach((item, index) => {
    const y: YChecklistItem = new Y.Map();
    y.set("id", item.id);
    y.set("text", item.text);
    y.set("checked", item.checked);
    if (item.indent === 1) y.set("indent", 1);
    y.set("order", index);
    map.set(item.id, y);
  });
  return map;
}

function plainChecklistFromY(value: unknown): ChecklistItem[] {
  if (value instanceof Y.Map) {
    const items: (ChecklistItem & { order: number })[] = [];
    value.forEach((v, id) => {
      if (items.length >= LIM.checklistItems) return;
      if (v instanceof Y.Map) {
        items.push({
          id: id.length > LIM.id ? id.slice(0, LIM.id) : id,
          text: safeString(v.get("text"), "", LIM.checklistText),
          checked: safeBool(v.get("checked")),
          ...(v.get("indent") === 1 ? { indent: 1 as const } : {}),
          order: safeNumber(v.get("order")),
        });
      }
    });
    items.sort((a, b) => a.order - b.order);
    return items.map(({ order: _order, ...rest }) => rest);
  }
  // Legacy notes persisted before checklist became a Y.Map — self-heals on next patch.
  if (Array.isArray(value)) {
    return value
      .filter((i): i is Record<string, unknown> => !!i && typeof i === "object" && typeof (i as { id?: unknown }).id === "string")
      .slice(0, LIM.checklistItems)
      .map((i) => ({ id: safeString(i.id, "", LIM.id), text: safeString(i.text, "", LIM.checklistText), checked: safeBool(i.checked) }));
  }
  return [];
}

/** Reconciles the checklist Y.Map towards `next`, touching only items that changed
 *  so unrelated concurrent edits (on other items) keep their own Yjs history. */
function applyChecklistDiff(y: YNote, next: ChecklistItem[]) {
  let map = y.get("checklist");
  if (!(map instanceof Y.Map)) {
    map = new Y.Map<YChecklistItem>();
    y.set("checklist", map);
  }
  const checklistMap = map as Y.Map<YChecklistItem>;
  const nextIds = new Set(next.map((i) => i.id));
  for (const id of Array.from(checklistMap.keys())) {
    if (!nextIds.has(id)) checklistMap.delete(id);
  }
  next.forEach((item, index) => {
    const existing = checklistMap.get(item.id);
    if (existing instanceof Y.Map) {
      if (existing.get("text") !== item.text) existing.set("text", item.text);
      if (existing.get("checked") !== item.checked) existing.set("checked", item.checked);
      if ((existing.get("indent") === 1) !== (item.indent === 1)) {
        if (item.indent === 1) existing.set("indent", 1);
        else existing.delete("indent");
      }
      if (existing.get("order") !== index) existing.set("order", index);
    } else {
      const y2: YChecklistItem = new Y.Map();
      y2.set("id", item.id);
      y2.set("text", item.text);
      y2.set("checked", item.checked);
      if (item.indent === 1) y2.set("indent", 1);
      y2.set("order", index);
      checklistMap.set(item.id, y2);
    }
  });
}

/** Wartości właściwości notatki: `Y.Map` klucz (id definicji) → skalar. Brak mapy = brak wartości. */
type YProps = Y.Map<unknown>;

function yPropsFromPlain(props: NoteProps): YProps {
  const map: YProps = new Y.Map();
  for (const [key, value] of Object.entries(props)) map.set(key, value);
  return map;
}

/** Zmienia tylko klucze, które się różnią — równoległa edycja innej właściwości tej samej notatki przeżywa. */
function applyPropsDiff(y: YNote, next: NoteProps) {
  let map = y.get("props");
  if (!(map instanceof Y.Map)) {
    map = new Y.Map();
    y.set("props", map);
  }
  const propsMap = map as YProps;
  for (const key of Array.from(propsMap.keys())) {
    if (!(key in next)) propsMap.delete(key);
  }
  for (const [key, value] of Object.entries(next)) {
    if (propsMap.get(key) !== value) propsMap.set(key, value);
  }
}

function plainPropsFromY(value: unknown): NoteProps {
  if (!(value instanceof Y.Map)) return {};
  return cleanNoteProps(Object.fromEntries(value.entries()));
}

/** Definicja właściwości w dokumencie: `Y.Map` z polami; id to klucz w `propDefs`. */
type YPropDef = Y.Map<unknown>;

function yPropDefFromPlain(def: PropDef): YPropDef {
  const y: YPropDef = new Y.Map();
  y.set("name", def.name);
  y.set("type", def.type);
  if (def.type === "select") y.set("options", def.options ?? []);
  y.set("order", def.order);
  return y;
}

function plainPropDefFromY(id: string, y: YPropDef): PropDef | null {
  return cleanPropDef({ id, name: y.get("name"), type: y.get("type"), options: y.get("options"), order: y.get("order") });
}

const NO_ATTACHMENTS: Attachment[] = [];

/** Manifest z dokumentu (może pochodzić od peera) → zwalidowana lista; brak = stała pusta tablica. */
function plainAttachments(raw: unknown): Attachment[] {
  if (!Array.isArray(raw) || raw.length === 0) return NO_ATTACHMENTS;
  const list = normalizeAttachments(raw);
  return list.length ? list : NO_ATTACHMENTS;
}

/** Pola, które w notatce prywatnej żyją tylko w zaszyfrowanym `vault`. */
const PRIVATE_FIELDS = ["title", "content", "checklist", "labels", "images", "attachments"] as const;
/** Metadane notatki prywatnej (V-3, krok 3): idą do szyfrogramu, gdy format na to pozwala. */
const PRIVATE_META = ["color", "folderId", "parentId", "icon"] as const;
type PrivateFields = Partial<Pick<Note, (typeof PRIVATE_FIELDS)[number] | (typeof PRIVATE_META)[number]>>;
const NO_CHECKLIST: ChecklistItem[] = [];
const NO_LABELS: string[] = [];

/** Notatka z poprawnym szyfrogramem — tylko taka jest traktowana jako prywatna. */
function isLockedPlain(note: Pick<Note, "locked" | "vault">): boolean {
  // Przegląd V-3, punkt 5: pełny kształt tokenu (wersja v1/v2, iv, szyfrogram), nie sam prefiks — zepsuty
  // token nie może ukryć zwykłej notatki jako zablokowanej.
  return note.locked === true && typeof note.vault === "string" && looksLikeVaultToken(note.vault);
}

function yNoteFromPlain(note: Note): YNote {
  const y: YNote = new Y.Map();
  const locked = isLockedPlain(note);
  const text = new Y.Text();
  // Notatka prywatna nigdy nie wchodzi do dokumentu z jawnym tekstem — nawet gdy wołający go podał.
  if (note.content && !locked) text.insert(0, note.content);
  y.set("content", text);
  y.set("title", locked ? "" : note.title);
  if (locked) { y.set("locked", true); y.set("vault", note.vault as string); }
  y.set("color", note.color);
  y.set("pinned", note.pinned);
  y.set("archived", note.archived);
  y.set("trashed", note.trashed);
  y.set("trashedAt", note.trashedAt);
  y.set("labels", locked ? [] : note.labels.slice());
  if (note.aliases?.length && !locked) y.set("aliases", note.aliases.slice());
  y.set("reminder", note.reminder);
  // Rodzaj z reguły (3.1) idzie zapasowo do `reminderRepeat`, żeby starsze wersje go czytały.
  const legacyRepeat = note.reminderRule ? fallbackRepeat(note.reminderRule) : note.reminderRepeat;
  if (legacyRepeat !== undefined) y.set("reminderRepeat", legacyRepeat);
  if (note.reminderDay !== undefined) y.set("reminderDay", note.reminderDay);
  if (note.reminderRepeatUntil !== undefined) y.set("reminderRepeatUntil", note.reminderRepeatUntil);
  y.set("reminderSpec", specOf({ reminder: note.reminder, reminderRepeat: legacyRepeat, reminderRule: note.reminderRule, reminderDay: note.reminderDay, reminderRepeatUntil: note.reminderRepeatUntil, reminderAllDay: note.reminderAllDay, reminderBase: note.reminderBase }));
  y.set("priority", note.priority);
  if (note.dailyDate !== undefined) y.set("dailyDate", note.dailyDate);
  if (note.reminderTime !== undefined) y.set("reminderTime", note.reminderTime);
  if (note.snoozedUntil !== undefined) y.set("snoozedUntil", note.snoozedUntil);
  if (note.periodKey !== undefined) y.set("periodKey", note.periodKey);
  if (note.icon) y.set("icon", note.icon);
  if (note.cover) y.set("cover", note.cover);
  if (note.favorite) y.set("favorite", true);
  if (note.readOnly) y.set("readOnly", true);
  if (note.parentId) y.set("parentId", note.parentId);
  if (note.wide) y.set("wide", true);
  if (note.largeText) y.set("largeText", true);
  y.set("checklist", yChecklistFromPlain(locked ? [] : note.checklist));
  y.set("folderId", note.folderId);
  y.set("order", note.order);
  y.set("imageHashes", locked ? [] : imageRefs(note.images));
  // Manifest załączników tylko, gdy są — dokumenty bez nich zostają bajt w bajt jak dawniej.
  if (note.attachments?.length && !locked) y.set("attachments", normalizeAttachments(note.attachments));
  // Właściwości nie idą do notatki prywatnej — nie ma ich w szyfrogramie, więc nie wyciekają jawnie.
  if (!locked && note.props && Object.keys(note.props).length) y.set("props", yPropsFromPlain(note.props));
  y.set("createdAt", note.createdAt);
  y.set("updatedAt", note.updatedAt);
  return y;
}

/**
 * Wartości z dokumentu mogą pochodzić od peera — każde pole przechodzi przez
 * `safeProjection` (zły typ = wartość domyślna), więc UI dostaje zawsze `Note`
 * zgodny z typem, a nie to, co ktoś wpisał do `Y.Map`.
 */
function plainFromYNote(id: string, y: YNote): Note {
  const vaultRaw = y.get("locked") === true ? y.get("vault") : undefined;
  const dailyDate = safeDailyDate(y.get("dailyDate"));
  const timeRaw = y.get("reminderTime");
  const reminderTime = typeof timeRaw === "number" && Number.isInteger(timeRaw) && timeRaw >= 0 && timeRaw < 1440 ? timeRaw : undefined;
  const snoozedRaw = y.get("snoozedUntil");
  const snoozedUntil = typeof snoozedRaw === "number" && Number.isFinite(snoozedRaw) && snoozedRaw > 0 ? snoozedRaw : undefined;
  const periodKey = safePeriodKey(y.get("periodKey"));
  const icon = safeString(y.get("icon"), "", LIM.emoji);
  const cover = safeOptionalEnum(y.get("cover"), NOTE_COVERS);
  const parentId = safeString(y.get("parentId"), "", LIM.id);
  const rem = readReminderState(y);
  const common = {
    ...(dailyDate ? { dailyDate } : {}),
    ...(snoozedUntil ? { snoozedUntil } : {}),
    ...(reminderTime !== undefined ? { reminderTime } : {}),
    ...(periodKey ? { periodKey } : {}),
    ...(icon ? { icon } : {}),
    ...(cover ? { cover } : {}),
    ...(parentId ? { parentId } : {}),
    ...(y.get("favorite") === true ? { favorite: true as const } : {}),
    ...(y.get("readOnly") === true ? { readOnly: true as const } : {}),
    ...(y.get("wide") === true ? { wide: true as const } : {}),
    ...(y.get("largeText") === true ? { largeText: true as const } : {}),
    id,
    color: safeEnum(y.get("color"), NOTE_COLORS, "default"),
    pinned: safeBool(y.get("pinned")),
    archived: safeBool(y.get("archived")),
    trashed: safeBool(y.get("trashed")),
    trashedAt: safeNullableNumber(y.get("trashedAt")),
    reminder: rem.reminder,
    reminderRepeat: rem.reminderRepeat,
    reminderRule: rem.reminderRule,
    reminderDay: rem.reminderDay,
    reminderRepeatUntil: rem.reminderRepeatUntil,
    reminderAllDay: rem.reminderAllDay,
    reminderBase: rem.reminderBase,
    priority: safeEnum(y.get("priority"), PRIORITIES, "none"),
    folderId: safeNullableString(y.get("folderId"), LIM.id),
    order: safeNumber(y.get("order")),
    createdAt: safeNumber(y.get("createdAt")),
    updatedAt: safeNumber(y.get("updatedAt")),
  };
  if (typeof vaultRaw === "string" && vaultRaw.length <= LIM.vault) {
    // Projekcja notatki prywatnej jest zredagowana z konstrukcji: wyszukiwarka, graf,
    // przegląd, eksport i backup widzą pustą notatkę z szyfrogramem.
    return { ...common, title: "", content: "", labels: NO_LABELS, images: NO_IMAGES, locked: true, vault: vaultRaw, checklist: NO_CHECKLIST };
  }
  const content = y.get("content");
  const images = y.get("imageHashes");
  const attachments = plainAttachments(y.get("attachments"));
  const labels = y.get("labels");
  const aliases = y.get("aliases");
  const props = plainPropsFromY(y.get("props"));
  return {
    ...common,
    ...(Object.keys(props).length ? { props } : {}),
    title: safeString(y.get("title"), "", LIM.title),
    content: content instanceof Y.Text ? content.toString() : safeString(content),
    labels: Array.isArray(labels) && labels.length ? safeStringArray(labels, LIM.labels, LIM.label) : NO_LABELS,
    images: Array.isArray(images) && images.length ? safeStringArray(images, LIM.imageRefs, LIM.imageRef) : NO_IMAGES,
    ...(attachments.length ? { attachments } : {}),
    ...(Array.isArray(aliases) && aliases.length ? { aliases: safeStringArray(aliases, LIM.aliases, LIM.label) } : {}),
    checklist: plainChecklistFromY(y.get("checklist")),
  };
}

function yFolderFromPlain(folder: Folder): YFolder {
  const y: YFolder = new Y.Map();
  y.set("name", folder.name);
  y.set("color", folder.color);
  y.set("emoji", folder.emoji);
  y.set("parentId", folder.parentId);
  y.set("order", folder.order);
  y.set("createdAt", folder.createdAt);
  y.set("updatedAt", folder.updatedAt ?? folder.createdAt);
  return y;
}

function plainFromYFolder(id: string, y: YFolder): Folder {
  const createdAt = safeNumber(y.get("createdAt"));
  return {
    id,
    name: safeString(y.get("name"), "", LIM.folderName),
    color: safeEnum(y.get("color"), NOTE_COLORS, "default"),
    emoji: safeNullableString(y.get("emoji"), LIM.emoji),
    parentId: safeNullableString(y.get("parentId"), LIM.id),
    order: safeNumber(y.get("order")),
    createdAt,
    updatedAt: safeOptionalNumber(y.get("updatedAt")) ?? createdAt,
  };
}

export function createYjsStore(dbName: string, images: ImageStore = defaultImageStore) {
  const doc = new Y.Doc();
  /** Otwarte sesje edycji: baza, którą widział edytor danej notatki. */
  const textBases = new Map<string, TextBase>();
  const notesMap = doc.getMap<YNote>("notes");
  const foldersMap = doc.getMap<YFolder>("folders");
  const labelsMap = doc.getMap<boolean>("labels");
  const propDefsMap = doc.getMap<YPropDef>("propDefs");
  const noteCache = new Map<string, Note>();
  const dirtyNotes = new Set<string>();
  /** Odbiorca zapisów treści notatek prywatnych (ustawia `privateNotes.ts`). */
  let lockedWriteSink: ((id: string, fields: PrivateFields) => boolean) | null = null;
  const vaultMap = doc.getMap<unknown>("vault");
  notesMap.observeDeep((events) => {
    for (const e of events) {
      if (e.target === notesMap) e.changes.keys.forEach((_c, k) => dirtyNotes.add(k));
      else if (typeof e.path[0] === "string") dirtyNotes.add(e.path[0]);
    }
  });
  const migratedKey = `kaczy.yjs.migrated.v1.${dbName}`;

  let persistence = new IndexeddbPersistence(dbName, doc);
  trackPersistence(doc, () => persistence);
  let readyPromise: Promise<void> | null = null;

  /**
   * Podmienia klucze w manifestach (np. stary hash FNV → SHA-256), bez ruszania
   * `updatedAt` — to nie jest zmiana użytkownika. Zwraca liczbę notatek.
   */
  function remapImageRefs(map: Map<string, string>): number {
    if (!map.size) return 0;
    let changed = 0;
    doc.transact(() => {
      notesMap.forEach((y) => {
        const refs = y.get("imageHashes");
        if (!Array.isArray(refs)) return;
        const next = (refs as string[]).map((r) => map.get(r) ?? r);
        if (next.some((r, i) => r !== refs[i])) { y.set("imageHashes", next); changed++; }
      });
    }, "image-migration");
    return changed;
  }

  /**
   * Data URL-e z `kaczy.images.v1`/`v2:*` → `imageStore`, manifesty FNV → SHA-256.
   * Notatka bez manifestu (sprzed jego istnienia) dostaje go z lokalnych obrazów.
   * Klucze FNV, których to urządzenie nie ma, zostają — peer, który ma obraz,
   * podmieni je u siebie. Stare klucze kasowane dopiero po zapisaniu wszystkich
   * obrazów; przerwana migracja powtórzy się przy następnym starcie.
   */
  async function migrateImagesToStore(): Promise<void> {
    const oldKeys = (await idbKeys()).filter((k): k is string => typeof k === "string" && k.startsWith(IMAGES_PREFIX));
    const legacy = await idbGet<ImagesById>(LEGACY_IMAGES_KEY);
    if (!oldKeys.length && !legacy) return;

    const byNote: ImagesById = { ...(legacy ?? {}) };
    const values = await idbGetMany<string[] | undefined>(oldKeys);
    oldKeys.forEach((k, i) => { if (values[i]?.length) byNote[k.slice(IMAGES_PREFIX.length)] = values[i]!; });

    const fnvToSha = new Map<string, string>();
    const localRefs: ImagesById = {};
    try {
      for (const [id, imgs] of Object.entries(byNote)) {
        const refs: string[] = [];
        for (const img of imgs ?? []) {
          if (!isDataUrl(img)) continue;
          const [ref] = await images.ingest([img]);
          if (!ref) continue;
          fnvToSha.set(hashImage(img), ref);
          refs.push(ref);
        }
        localRefs[id] = refs;
      }
    } catch (err) {
      logDiag("error", "yjsStore", "image migration failed — old images kept, will retry", err);
      return;
    }

    doc.transact(() => {
      for (const [id, refs] of Object.entries(localRefs)) {
        const y = notesMap.get(id);
        if (y && !Array.isArray(y.get("imageHashes")) && refs.length) y.set("imageHashes", refs);
      }
    }, "image-migration");
    remapImageRefs(fnvToSha);

    try {
      for (const k of oldKeys) await idbDel(k);
      if (legacy) await idbDel(LEGACY_IMAGES_KEY);
    } catch (err) { logDiag("warn", "yjsStore", "cannot delete migrated image keys", err); }
  }

  /** Liczniki do raportu diagnostycznego — tylko flagi, bez treści notatek. */
  function diagStats() {
    let notes = 0, archived = 0, trashed = 0;
    notesMap.forEach((n) => {
      if (n.get("trashed")) trashed++;
      else if (n.get("archived")) archived++;
      else notes++;
    });
    return {
      counts: { notes, archived, trashed, folders: foldersMap.size, labels: labelsMap.size },
      stateVectorBytes: Y.encodeStateVector(doc).byteLength,
    };
  }

  async function migrateFromLegacyIfNeeded(): Promise<void> {
    let migrated = false;
    try { migrated = Boolean(localStorage.getItem(migratedKey)); } catch { /* ignore */ }
    if (migrated) return;

    if (notesMap.size > 0 || foldersMap.size > 0 || labelsMap.size > 0) {
      // Doc already has content (e.g. persisted before the flag existed) — nothing to migrate.
      try { localStorage.setItem(migratedKey, "1"); } catch { /* ignore */ }
      return;
    }

    const snapshot = await loadLegacySnapshot();
    if (snapshot.notes.length || snapshot.folders.length || snapshot.labels.length) {
      const notes = await Promise.all(snapshot.notes.map(async (n) => ({ ...n, images: await images.ingest(n.images ?? []) })));
      doc.transact(() => {
        for (const note of notes) notesMap.set(note.id, yNoteFromPlain(note));
        for (const folder of snapshot.folders) foldersMap.set(folder.id, yFolderFromPlain(folder));
        for (const label of snapshot.labels) labelsMap.set(label, true);
      });
    }
    try { localStorage.setItem(migratedKey, "1"); } catch { /* ignore */ }
  }

  function ready(): Promise<void> {
    if (!readyPromise) {
      readyPromise = (async () => {
        // Zablokowane IndexedDB (tryb prywatny, brak miejsca) nie może zawiesić aplikacji
        // na „ładowaniu”: po 8 s idziemy dalej na samej pamięci, a zapis zgłaszamy w diagnostyce.
        let timer: ReturnType<typeof setTimeout> | undefined;
        const synced = await Promise.race([
          persistence.whenSynced.then(() => true, () => false),
          new Promise<boolean>((r) => { timer = setTimeout(() => r(false), 8000); }),
        ]);
        if (timer) clearTimeout(timer);
        if (!synced) logDiag("error", "yjs", "IndexedDB nie odpowiada — zmiany mogą nie zostać zapisane");
        await images.load();
        await migrateImagesToStore();
        await migrateFromLegacyIfNeeded();
      })();
    }
    return readyPromise;
  }

  /**
   * Projekcja inkrementalna: notatki nietknięte od ostatniego wywołania
   * zachowują tożsamość obiektu, więc `memo(NoteCard)` i memo filtrów
   * mają co porównywać. Brudne id zbiera obserwator zarejestrowany
   * przy tworzeniu store'a — przed obserwatorami UI.
   */
  function projectNotes(): Note[] {
    const result: Note[] = [];
    notesMap.forEach((y, id) => {
      let note = noteCache.get(id);
      if (!note || dirtyNotes.has(id)) {
        note = plainFromYNote(id, y);
        noteCache.set(id, note);
      }
      result.push(note);
    });
    dirtyNotes.clear();
    if (noteCache.size > result.length) {
      for (const id of noteCache.keys()) if (!notesMap.has(id)) noteCache.delete(id);
    }
    return result;
  }

  function projectFolders(): Folder[] {
    const result: Folder[] = [];
    foldersMap.forEach((y, id) => result.push(plainFromYFolder(id, y)));
    return result;
  }

  function projectLabels(): string[] {
    // Zbiór etykiet + te, których używa jakaś notatka: notatka z etykietą spoza zbioru (np. z importu)
    // nie może znikać z paska bocznego.
    const all = new Set(labelsMap.keys());
    notesMap.forEach((y) => {
      const raw = y.get("labels");
      if (Array.isArray(raw)) for (const l of raw) if (typeof l === "string" && l) all.add(l);
    });
    return Array.from(all).sort((a, b) => a.localeCompare(b));
  }

  /** Definicje właściwości po kolejności; uszkodzony wpis od peera jest pomijany. */
  function projectPropDefs(): PropDef[] {
    const list: PropDef[] = [];
    propDefsMap.forEach((y, id) => {
      const def = plainPropDefFromY(id, y);
      if (def) list.push(def);
    });
    return cleanPropDefs(list);
  }

  /** Dodaje albo zmienia definicję (nazwa, opcje). Typ nie zmienia się po utworzeniu. */
  function upsertPropDef(def: PropDef): void {
    doc.transact(() => {
      propDefsMap.set(def.id, yPropDefFromPlain(def));
    });
  }

  /** Usuwa definicję i jej wartości we wszystkich notatkach — w jednej transakcji. */
  function deletePropDef(id: string): void {
    doc.transact(() => {
      propDefsMap.delete(id);
      notesMap.forEach((y) => {
        const props = y.get("props");
        if (props instanceof Y.Map && props.has(id)) props.delete(id);
      });
    });
  }

  function upsertNote(note: Note): void {
    doc.transact(() => {
      notesMap.set(note.id, yNoteFromPlain(note));
    });
  }

  function applyPatch(id: string, y: YNote, updates: Partial<Omit<Note, "id" | "createdAt">>) {
    if (y.get("locked") === true) {
      // Notatka prywatna: pól treści nie wolno zapisać jawnie. Idą do sesji skarbca,
      // która zaszyfruje je i zapisze `vault` (patrz `privateNotes.ts`).
      const rest: Record<string, unknown> = { ...updates };
      const priv: Record<string, unknown> = {};
      const metaSecret = writeFormatAllowed(METADATA_IN_CIPHERTEXT_SCHEMA);
      for (const f of [...PRIVATE_FIELDS, ...(metaSecret ? PRIVATE_META : [])] as string[]) {
        if (f in rest) { priv[f] = rest[f]; delete rest[f]; }
      }
      delete rest.locked;
      delete rest.vault;
      // Właściwości nie są w szyfrogramie — przy notatce prywatnej pomijamy je po cichu.
      delete rest.props;
      const accepted = Object.keys(priv).length === 0 || (lockedWriteSink?.(id, priv as PrivateFields) ?? false);
      // Przegląd V-3 (punkt 1): metadane przy zablokowanym skarbcu NIE zapisują się jawnie — odrzucamy je
      // i mówimy o tym użytkownikowi. Przy zamkniętej bramce schematu zostaje dotychczasowe zachowanie (jawne).
      if (!accepted && metaSecret && (PRIVATE_META as readonly string[]).some((f) => f in priv)) {
        toast.info("Odblokuj skarbiec, aby zmienić kolor, folder lub rodzica notatki prywatnej", { id: "private-meta-locked" });
      }
      if (!accepted && !metaSecret) for (const f of PRIVATE_META) if (f in priv) rest[f] = priv[f];
      updates = rest as typeof updates;
    }
    if (updates.content !== undefined) {
      const text = y.get("content");
      const base = textBases.get(id);
      if (text instanceof Y.Text && base) textBases.set(id, applyTextEdit(text, base, updates.content));
      else if (text instanceof Y.Text) applyTextDiff(text, updates.content);
      else {
        const t = new Y.Text();
        if (updates.content) t.insert(0, updates.content);
        y.set("content", t);
      }
    }
    // Przypomnienie idzie jednym zapisem `reminderSpec` — bieżący stan czytamy przed nadpisaniem pól.
    const remBefore = REMINDER_FIELDS.some((f) => f in updates) ? readReminderState(y) : null;
    for (const field of NOTE_SCALAR_FIELDS) {
      if (field in updates) y.set(field, (updates as Record<string, unknown>)[field]);
    }
    // Zapasowy rodzaj z reguły zapisuje się także w polu sprzed zmiany (starsze wersje czytają je, nie `reminderSpec`).
    if (updates.reminderRule) y.set("reminderRepeat", fallbackRepeat(updates.reminderRule));
    if (remBefore) y.set("reminderSpec", mergeSpec(remBefore, updates));
    if (updates.checklist !== undefined) applyChecklistDiff(y, updates.checklist);
    if (updates.images !== undefined) y.set("imageHashes", imageRefs(updates.images));
    if (updates.attachments !== undefined) y.set("attachments", normalizeAttachments(updates.attachments));
    if (updates.props !== undefined) applyPropsDiff(y, cleanNoteProps(updates.props));
    if (!("updatedAt" in updates)) y.set("updatedAt", Date.now());
  }

  function patchNote(id: string, updates: Partial<Omit<Note, "id" | "createdAt">>): void {
    const y = notesMap.get(id);
    if (!y) return;
    doc.transact(() => applyPatch(id, y, updates));
  }

  function patchNotes(ids: string[], updates: Partial<Omit<Note, "id" | "createdAt">>): void {
    doc.transact(() => {
      for (const id of ids) {
        const y = notesMap.get(id);
        if (y) applyPatch(id, y, updates);
      }
    });
  }

  /**
   * Edytor otwiera sesję, zanim użytkownik zacznie pisać: zapamiętujemy treść
   * i tożsamości znaków, które widzi. Zapisy treści tej notatki idą potem
   * względem tej bazy, więc zmiany peera z czasu edycji nie są kasowane.
   * Zwraca treść bazy — to ona powinna trafić do pola edycji.
   */
  function beginTextEdit(id: string): string | null {
    if (notesMap.get(id)?.get("locked") === true) return null;
    const text = notesMap.get(id)?.get("content");
    if (!(text instanceof Y.Text)) return null;
    const base = captureTextBase(text);
    textBases.set(id, base);
    return base.text;
  }

  /**
   * Żywy `Y.Text` treści notatki dla edytora CM, który wiąże się z dokumentem (plan Fazy 1b).
   * `null` dla notatek prywatnych (szyfrogram, brak `Y.Text`) — one zostają przy zapisie przez sesję.
   */
  function getNoteText(id: string): Y.Text | null {
    if (notesMap.get(id)?.get("locked") === true) return null;
    const text = notesMap.get(id)?.get("content");
    return text instanceof Y.Text ? text : null;
  }

  function endTextEdit(id: string): void {
    textBases.delete(id);
  }

  /** Czy edytor tej notatki jest teraz otwarty (trwa sesja edycji treści). */
  function isTextEditOpen(id: string): boolean {
    return textBases.has(id);
  }

  /**
   * Wlewa do otwartego edytora zmiany, które peer zrobił w treści: najpierw
   * scala niezapisany szkic (bez ruszania `updatedAt` — to nie jest zapis
   * użytkownika), potem zwraca aktualny tekst i przeliczone zaznaczenie.
   * `null`, gdy dla tej notatki nie ma otwartej sesji.
   */
  function rebaseTextEdit(id: string, draft: string, selection: [number, number]): { text: string; selection: [number, number] } | null {
    const text = notesMap.get(id)?.get("content");
    const base = textBases.get(id);
    if (!(text instanceof Y.Text) || !base) return null;
    let local = base;
    doc.transact(() => { local = applyTextEdit(text, base, draft); });
    const next = captureTextBase(text);
    textBases.set(id, next);
    return { text: next.text, selection: [mapOffset(local, selection[0], next), mapOffset(local, selection[1], next)] };
  }

  /** Zmiany treści notatki przychodzące od peera (nie z tej karty). */
  function onRemoteTextChange(id: string, listener: () => void): () => void {
    const text = notesMap.get(id)?.get("content");
    if (!(text instanceof Y.Text)) return () => {};
    const handler = (_e: Y.YTextEvent, tr: Y.Transaction) => { if (!tr.local) listener(); };
    text.observe(handler);
    return () => text.unobserve(handler);
  }

  /**
   * Wszystkie klucze bajtów w `imageStore`, do których odwołuje się jakakolwiek
   * notatka (także w Koszu) albo wpis dziennika z budowy: obrazy ORAZ załączniki. To wejście dla GC — blob
   * używany przez inną notatkę (ten sam hash) nigdy nie jest kandydatem.
   */
  function referencedImages(): Set<string> {
    const refs = new Set<string>();
    notesMap.forEach((y) => {
      const list = y.get("imageHashes");
      if (Array.isArray(list)) for (const r of list) if (typeof r === "string") refs.add(r);
      for (const a of plainAttachments(y.get("attachments"))) refs.add(a.hash);
    });
    // Zdjęcia dziennika z budowy (Nauka) — te same bajty w `imageStore`.
    for (const r of journalRefsIn(doc)) refs.add(r);
    return refs;
  }

  /** Załączniki wszystkich notatek: hash → manifest (rozmiar do limitu łącznego i backupu). */
  function referencedAttachments(): Map<string, Attachment> {
    const out = new Map<string, Attachment>();
    notesMap.forEach((y) => {
      for (const a of plainAttachments(y.get("attachments"))) if (!out.has(a.hash)) out.set(a.hash, a);
    });
    return out;
  }

  /**
   * Klucze, które wolno wysłać innemu urządzeniu (P2P, plik sync): wszystkie
   * obrazy (także zdjęcia dziennika z budowy) i załączniki do `ATTACHMENT_SYNC_MAX_BYTES`. Większe pliki są
   * lokalne dla urządzenia (UI mówi o tym wprost).
   */
  function syncableRefs(): Set<string> {
    const refs = new Set<string>();
    notesMap.forEach((y) => {
      const list = y.get("imageHashes");
      if (Array.isArray(list)) for (const r of list) if (typeof r === "string") refs.add(r);
    });
    referencedAttachments().forEach((a, hash) => { if (isAttachmentSyncable(a)) refs.add(hash); });
    for (const r of journalRefsIn(doc, true)) refs.add(r);
    return refs;
  }

  /** Persists a manual drag order (index per id) in one transaction. */
  function setNoteOrder(ids: string[]): void {
    doc.transact(() => {
      ids.forEach((id, index) => {
        const y = notesMap.get(id);
        if (y) y.set("order", index);
      });
    });
  }

  /** Bajty obrazów zostają w `imageStore` — sprząta je GC po karencji. */
  function removeNote(id: string): void {
    doc.transact(() => { notesMap.delete(id); });
  }

  function removeNotes(ids: string[]): void {
    doc.transact(() => {
      for (const id of ids) notesMap.delete(id);
    });
  }

  function upsertFolder(folder: Folder): void {
    doc.transact(() => { foldersMap.set(folder.id, yFolderFromPlain(folder)); });
  }

  function patchFolder(id: string, updates: Partial<Omit<Folder, "id" | "createdAt">>): void {
    const y = foldersMap.get(id);
    if (!y) return;
    doc.transact(() => {
      for (const field of FOLDER_SCALAR_FIELDS) {
        if (field in updates) y.set(field, (updates as Record<string, unknown>)[field]);
      }
      y.set("updatedAt", Date.now());
    });
  }

  function removeFolder(id: string): void {
    doc.transact(() => { foldersMap.delete(id); });
  }

  function addLabel(label: string): void {
    if (labelsMap.has(label)) return;
    doc.transact(() => { labelsMap.set(label, true); });
  }

  /** Removes a label from the label set and strips it from every note, in one transaction. */
  function removeLabelEverywhere(label: string): void {
    doc.transact(() => {
      labelsMap.delete(label);
      notesMap.forEach((y) => {
        const raw = y.get("labels");
        const labels = Array.isArray(raw) ? (raw as string[]) : [];
        if (labels.includes(label)) y.set("labels", labels.filter((l) => l !== label));
      });
    });
  }

  /** Renames a label in the label set and in every note referencing it, in one transaction. */
  /**
   * Zmiana nazwy etykiety wraz z jej poddrzewem (`budowa` → `dom`: także `budowa/łazienka` → `dom/łazienka`).
   * Dotyczy zbioru etykiet i każdej notatki, która ma którąkolwiek z przepinanych etykiet.
   */
  function renameLabelEverywhere(oldLabel: string, newLabel: string): void {
    const target = cleanLabelPath(newLabel);
    if (!target || target === oldLabel) return;
    doc.transact(() => {
      const branch = [...labelsMap.keys()].filter((k) => isUnderLabel(k, oldLabel));
      for (const k of branch) labelsMap.delete(k);
      for (const k of branch) labelsMap.set(renameLabelBranch([k], oldLabel, target)[0], true);
      if (!branch.length) labelsMap.set(target, true);
      notesMap.forEach((y) => {
        const raw = y.get("labels");
        const labels = Array.isArray(raw) ? (raw as string[]) : [];
        if (!labels.some((l) => isUnderLabel(l, oldLabel))) return;
        y.set("labels", renameLabelBranch(labels, oldLabel, target));
      });
    });
  }

  /** Jawna, pełna notatka z dokumentu (dla skarbca przy blokowaniu). `null`, gdy nie ma albo jest już prywatna. */
  function readPlainNote(id: string): Note | null {
    const y = notesMap.get(id);
    if (!y || y.get("locked") === true) return null;
    return plainFromYNote(id, y);
  }

  function isLocked(id: string): boolean {
    return notesMap.get(id)?.get("locked") === true;
  }

  /** Id wszystkich notatek prywatnych (też w koszu i archiwum). */
  function lockedNoteIds(): string[] {
    const ids: string[] = [];
    notesMap.forEach((y, id) => { if (y.get("locked") === true && typeof y.get("vault") === "string") ids.push(id); });
    return ids;
  }

  function getVault(id: string): string | null {
    const y = notesMap.get(id);
    const v = y?.get("locked") === true ? y.get("vault") : undefined;
    return typeof v === "string" ? v : null;
  }

  /**
   * Zamienia notatkę w prywatną: jawne pola znikają z dokumentu (stary `Y.Text` i
   * mapa listy są zastępowane nowymi, więc ich zawartość zostaje odśmiecona),
   * zostaje szyfrogram. Jedna transakcja.
   */
  function lockNote(id: string, vault: string, dropMeta = false): boolean {
    const y = notesMap.get(id);
    if (!y || y.get("locked") === true) return false;
    doc.transact(() => {
      y.set("content", new Y.Text());
      y.set("title", "");
      y.set("labels", []);
      y.set("checklist", new Y.Map<YChecklistItem>());
      y.set("imageHashes", []);
      y.delete("attachments");
      // Metadane idą do szyfrogramu (krok 3): z dokumentu znikają jawne wartości.
      if (dropMeta) for (const f of PRIVATE_META) y.delete(f);
      y.set("vault", vault);
      y.set("locked", true);
      y.set("updatedAt", Date.now());
    });
    textBases.delete(id);
    return true;
  }

  /** Nowy szyfrogram istniejącej notatki prywatnej. */
  function setVault(id: string, vault: string, touch = true): boolean {
    const y = notesMap.get(id);
    if (!y || y.get("locked") !== true) return false;
    doc.transact(() => {
      y.set("vault", vault);
      if (touch) y.set("updatedAt", Date.now());
    });
    return true;
  }

  /** Zdejmuje blokadę: jawna treść wraca do dokumentu, szyfrogram znika. */
  function unlockNote(id: string, plain: Pick<Note, "title" | "content" | "checklist" | "labels"> & Partial<Pick<Note, "color" | "folderId" | "parentId" | "icon">>): boolean {
    const y = notesMap.get(id);
    if (!y || y.get("locked") !== true) return false;
    doc.transact(() => {
      const text = new Y.Text();
      if (plain.content) text.insert(0, plain.content);
      y.set("content", text);
      y.set("title", plain.title);
      y.set("labels", plain.labels.slice());
      y.set("checklist", yChecklistFromPlain(plain.checklist));
      // Metadane z szyfrogramu wracają do dokumentu, ale tylko tam, gdzie dokument ich nie ma: wartość jawna
      // (zapisana przy zablokowanym skarbcu) jest świeższa niż ta z szyfrogramu. Starsze treści: zostają jak były.
      for (const f of PRIVATE_META) if (plain[f] !== undefined && y.get(f) === undefined) y.set(f, plain[f]);
      y.delete("vault");
      y.delete("locked");
      y.set("updatedAt", Date.now());
    });
    return true;
  }

  function getVaultMeta(): unknown {
    return vaultMap.get("meta");
  }

  function setVaultMeta(meta: unknown): void {
    doc.transact(() => { vaultMap.set("meta", meta); });
  }

  function observeVaultMeta(listener: () => void): () => void {
    vaultMap.observe(listener);
    return () => vaultMap.unobserve(listener);
  }

  /**
   * Zmiana klucza skarbca: nowe metadane i nowe szyfrogramy wszystkich podanych
   * notatek w JEDNEJ transakcji — peer widzi albo stary stan, albo cały nowy.
   * Zwraca `false` (nic nie zapisuje), gdy któraś notatka zmieniła szyfrogram
   * od chwili, gdy go odczytano (`expected`), albo przestała być prywatna.
   */
  function rekeyVault(meta: unknown, next: Map<string, { expected: string; vault: string }>): boolean {
    for (const [id, { expected }] of next) if (getVault(id) !== expected) return false;
    doc.transact(() => {
      for (const [id, { vault }] of next) notesMap.get(id)!.set("vault", vault);
      vaultMap.set("meta", meta);
    });
    return true;
  }

  function setLockedWriteSink(sink: typeof lockedWriteSink): void {
    lockedWriteSink = sink;
  }

  /**
   * Dziennik aktualizacji y-indexeddb trzyma dawne aktualizacje (z jawnym
   * tekstem sprzed zablokowania) aż do własnego zagęszczenia. Tu zagęszczamy
   * od razu: jedna aktualizacja ze stanem dokumentu zamiast historii.
   * Nie dotyczy innych urządzeń ani wcześniejszych kopii zapasowych.
   */
  async function compactPersistence(): Promise<boolean> {
    try {
      await persistence.whenSynced;
      const db = persistence.db;
      if (!db) return false;
      const state = Y.encodeStateAsUpdate(doc);
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["updates"], "readwrite");
        const store = tx.objectStore("updates");
        const keysReq = store.getAllKeys();
        keysReq.onsuccess = () => {
          const old = keysReq.result;
          const addReq = store.add(state);
          addReq.onsuccess = () => { for (const k of old) store.delete(k); };
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      return true;
    } catch (err) {
      logDiag("warn", "yjsStore", "cannot compact persistence", err);
      return false;
    }
  }

  /** Destructive full replace (used by "restore from backup file") — not a merge. */
  function replaceAll(notes: Note[], folders: Folder[], labels: string[], propDefs: PropDef[] = []): void {
    doc.transact(() => {
      notesMap.forEach((_v, k) => notesMap.delete(k));
      foldersMap.forEach((_v, k) => foldersMap.delete(k));
      labelsMap.forEach((_v, k) => labelsMap.delete(k));
      propDefsMap.forEach((_v, k) => propDefsMap.delete(k));
      for (const note of notes) notesMap.set(note.id, yNoteFromPlain(note));
      for (const folder of folders) foldersMap.set(folder.id, yFolderFromPlain(folder));
      for (const label of labels) labelsMap.set(label, true);
      for (const def of cleanPropDefs(propDefs)) propDefsMap.set(def.id, yPropDefFromPlain(def));
    });
  }

  /** Pełny stan dokumentu (update V2) — do pliku „sneakernet”. Bajty obrazów dokłada `yjsFileSync`. */
  function encodeSyncState(): Uint8Array {
    return Y.encodeStateAsUpdateV2(doc);
  }

  /** Scala stan z pliku z bieżącym dokumentem — CRDT merge, nie nadpisanie. */
  function mergeSyncState(update: Uint8Array): { newNotes: number } {
    const before = new Set(notesMap.keys());
    Y.applyUpdateV2(doc, update, "file-merge");
    let newNotes = 0;
    notesMap.forEach((_y, id) => { if (!before.has(id)) newNotes++; });
    return { newNotes };
  }

  /** Test-only: destroy this store's Yjs doc/IDB persistence, and start fresh. */
  async function resetForTests(): Promise<void> {
    await persistence.clearData();
    // Wszystkie mapy dokumentu — także te, które dokładają inne moduły (Grafik).
    doc.transact(() => {
      doc.share.forEach((type) => {
        if (type instanceof Y.Map) Array.from(type.keys()).forEach((k) => type.delete(k));
      });
    });
    noteCache.clear();
    readyPromise = null;
    try { localStorage.removeItem(migratedKey); } catch { /* ignore */ }
    persistence = new IndexeddbPersistence(dbName, doc);
  }

  /** Czy transakcja to wczytanie z IndexedDB (origin y-indexeddb) — dla synchronizacji kart. */
  const isPersistenceOrigin = (origin: unknown) => origin === persistence;

  return {
    doc, notesMap, foldersMap, labelsMap, images, isPersistenceOrigin,
    ready, projectNotes, projectFolders, projectLabels, projectPropDefs, upsertPropDef, deletePropDef, propDefsMap,
    upsertNote, patchNote, patchNotes, setNoteOrder, removeNote, removeNotes,
    upsertFolder, patchFolder, removeFolder,
    addLabel, removeLabelEverywhere, renameLabelEverywhere,
    replaceAll, resetForTests, diagStats, encodeSyncState, mergeSyncState,
    referencedImages, referencedAttachments, syncableRefs, remapImageRefs,
    beginTextEdit, endTextEdit, isTextEditOpen, rebaseTextEdit, onRemoteTextChange, getNoteText,
    readPlainNote, isLocked, lockedNoteIds, getVault, lockNote, setVault, unlockNote,
    getVaultMeta, setVaultMeta, observeVaultMeta, rekeyVault, setLockedWriteSink, compactPersistence,
  };
}

export type YjsStore = ReturnType<typeof createYjsStore>;

export const yjsStore = createYjsStore("kaczy-yjs-v1");
