import * as Y from "yjs";
import { looksLikeVaultToken } from "@/lib/vault";
import { normalizeAttachments, type Attachment } from "@/lib/attachments";
import { isDataUrl } from "@/lib/imageStore";
import type { Note, Folder, ChecklistItem } from "@/lib/types/note";
import { logDiag } from "@/lib/diagnostics";
import { NOTE_COVERS } from "@/lib/noteLook";
import { cleanNoteProps, cleanPropDef, hasPropOptions, type NoteProps, type PropDef } from "@/lib/noteProps";
import { projectReminder, readSpec, specOf, type ReminderState } from "@/lib/reminderSpec";
import { fallbackRepeat } from "@/lib/reminderRepeat";
import {
  NOTE_COLORS, PRIORITIES, REMINDER_REPEATS, REMOTE_LIMITS as LIM, safeBool, safeDailyDate, safeEnum,
  safeNullableNumber, safeNullableString, safeNumber, safeOptionalEnum, safeOptionalNumber, safePeriodKey,
  safeReminderDay, safeString, safeStringArray,
} from "@/lib/safeProjection";
/**
 * Konwersje dokumentu Yjs ↔ zwykłe obiekty (notatka, folder, lista zadań, właściwości, załączniki).
 * Czyste funkcje bez stanu — wydzielone z `yjsStore.ts` (F3, krok 1).
 */

export type YNote = Y.Map<unknown>;
export type YFolder = Y.Map<unknown>;
export type YChecklistItem = Y.Map<unknown>;
export type ImagesById = Record<string, string[]>;
/** Wspólna pusta lista — stabilna tożsamość dla notatek bez obrazów. */
export const NO_IMAGES: string[] = [];

/**
 * Do dokumentu trafiają wyłącznie klucze. Data URL tutaj to błąd wołającego
 * (powinien przejść przez `imageStore.ingest`) — wpisany do Y.Doc rozjechałby
 * się do wszystkich peerów jako megabajty base64.
 */
export function imageRefs(images: string[]): string[] {
  if (!images.some(isDataUrl)) return images.slice();
  logDiag("error", "yjsStore", "data URL passed as an image ref — dropped (caller must ingest first)");
  return images.filter((img) => !isDataUrl(img));
}

/** Przypomnienie z dokumentu: `reminderSpec`, a gdy go nie ma — stare pola (notatki sprzed zmiany). */
export function readReminderState(y: YNote): ReminderState {
  return projectReminder(readSpec(y.get("reminderSpec")), {
    reminder: safeNullableNumber(y.get("reminder")),
    reminderRepeat: safeOptionalEnum(y.get("reminderRepeat"), REMINDER_REPEATS),
    reminderDay: safeReminderDay(y.get("reminderDay")),
    reminderRepeatUntil: safeOptionalNumber(y.get("reminderRepeatUntil")),
  });
}

/** Klucz `Y.Map` jawnej notatki z nieznanymi polami treści szyfrogramu (JSON); nie trafia do `Note`. */
export const FUTURE_CONTENT_KEY = "futureContent";

export const NOTE_SCALAR_FIELDS = [
  "title", "color", "pinned", "archived", "trashed", "trashedAt",
  "labels", "aliases", "reminder", "reminderRepeat", "reminderDay", "reminderRepeatUntil", "priority", "dailyDate", "periodKey", "snoozedUntil",
  "icon", "cover", "favorite", "readOnly", "parentId", "wide", "largeText", "folderId", "order", "createdAt", "updatedAt",
] as const;

export const FOLDER_SCALAR_FIELDS = [
  "name", "color", "emoji", "parentId", "order", "createdAt", "updatedAt", "templateId",
] as const;

/**
 * Common-prefix/suffix diff so unrelated surrounding text keeps stable Yjs positions.
 * Tylko dla zapisów **bez** otwartej sesji edycji (import, szablony, duplikaty):
 * liczy diff od bieżącego stanu CRDT, więc nadpisałby współbieżne zmiany peera.
 * Edytor idzie przez `beginTextEdit` → `applyTextEdit` (patrz `yTextEdit.ts`).
 */
export function applyTextDiff(ytext: Y.Text, next: string) {
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
export function yChecklistFromPlain(items: ChecklistItem[] | undefined): Y.Map<YChecklistItem> {
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

export function plainChecklistFromY(value: unknown): ChecklistItem[] {
  if (value instanceof Y.Map) {
    const items: (ChecklistItem & { order: number })[] = [];
    value.forEach((v, id) => {
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
    // A4.5: remis `order` (dwie pozycje dodane naraz na dwóch urządzeniach) rozstrzyga id — kolejność iteracji `Y.Map`
    // to kolejność wstawienia na danym urządzeniu, więc bez tego telefon i komputer pokazywały listę inaczej.
    // Limit liczby pozycji dopiero po sortowaniu, żeby oba urządzenia odcinały te same pozycje.
    items.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return items.slice(0, LIM.checklistItems).map(({ order: _order, ...rest }) => rest);
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
export function applyChecklistDiff(y: YNote, next: ChecklistItem[]) {
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
export type YProps = Y.Map<unknown>;

export function yPropsFromPlain(props: NoteProps): YProps {
  const map: YProps = new Y.Map();
  for (const [key, value] of Object.entries(props)) map.set(key, value);
  return map;
}

/** Zmienia tylko klucze, które się różnią — równoległa edycja innej właściwości tej samej notatki przeżywa. */
export function applyPropsDiff(y: YNote, next: NoteProps) {
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

export function plainPropsFromY(value: unknown): NoteProps {
  if (!(value instanceof Y.Map)) return {};
  return cleanNoteProps(Object.fromEntries(value.entries()));
}

/** Definicja właściwości w dokumencie: `Y.Map` z polami; id to klucz w `propDefs`. */
export type YPropDef = Y.Map<unknown>;

export function yPropDefFromPlain(def: PropDef): YPropDef {
  const y: YPropDef = new Y.Map();
  y.set("name", def.name);
  y.set("type", def.type);
  if (hasPropOptions(def.type)) y.set("options", def.options ?? []);
  y.set("order", def.order);
  return y;
}

export function plainPropDefFromY(id: string, y: YPropDef): PropDef | null {
  return cleanPropDef({ id, name: y.get("name"), type: y.get("type"), options: y.get("options"), order: y.get("order") });
}

export const NO_ATTACHMENTS: Attachment[] = [];

/** Manifest z dokumentu (może pochodzić od peera) → zwalidowana lista; brak = stała pusta tablica. */
export function plainAttachments(raw: unknown): Attachment[] {
  if (!Array.isArray(raw) || raw.length === 0) return NO_ATTACHMENTS;
  const list = normalizeAttachments(raw);
  return list.length ? list : NO_ATTACHMENTS;
}

/** Pola, które w notatce prywatnej żyją tylko w zaszyfrowanym `vault`. */
export const PRIVATE_FIELDS = ["title", "content", "checklist", "labels", "images", "attachments"] as const;
/** Metadane notatki prywatnej (V-3, krok 3): idą do szyfrogramu, gdy format na to pozwala. */
export const PRIVATE_META = ["color", "folderId", "parentId", "icon"] as const;
export type PrivateFields = Partial<Pick<Note, (typeof PRIVATE_FIELDS)[number] | (typeof PRIVATE_META)[number]>>;
export const NO_CHECKLIST: ChecklistItem[] = [];
export const NO_LABELS: string[] = [];

/** Notatka z poprawnym szyfrogramem — tylko taka jest traktowana jako prywatna. */
export function isLockedPlain(note: Pick<Note, "locked" | "vault">): boolean {
  // Przegląd V-3, punkt 5: pełny kształt tokenu (wersja v1/v2, iv, szyfrogram), nie sam prefiks — zepsuty
  // token nie może ukryć zwykłej notatki jako zablokowanej.
  return note.locked === true && typeof note.vault === "string" && looksLikeVaultToken(note.vault);
}

export function yNoteFromPlain(note: Note): YNote {
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
  y.set("reminderSpec", specOf({ reminder: note.reminder, reminderRepeat: legacyRepeat, reminderRule: note.reminderRule, reminderDay: note.reminderDay, reminderRepeatUntil: note.reminderRepeatUntil, reminderAllDay: note.reminderAllDay, reminderBase: note.reminderBase, reminderLead: note.reminderLead }));
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
export function plainFromYNote(id: string, y: YNote): Note {
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
    ...(rem.reminderLead !== undefined ? { reminderLead: rem.reminderLead } : {}),
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

/**
 * D1.1: podmiana mapy pól folderu albo właściwości nową mapą gubiłaby klucze nowszej wersji — przenosimy je ze starej
 * (tylko wartości proste; zagnieżdżonych typów Yjs nie da się przenieść między mapami).
 */
// Nowa `Y.Map` przed wpięciem do dokumentu nie odpowiada na `has()` — stąd jawne listy kluczy znanych tej wersji.
export const FOLDER_KEYS: ReadonlySet<string> = new Set(["name", "color", "emoji", "parentId", "order", "createdAt", "updatedAt", "templateId"]);
export const PROP_DEF_KEYS: ReadonlySet<string> = new Set(["name", "type", "options", "order"]);
export function keepForeignKeys<T extends Y.Map<unknown>>(prev: unknown, next: T, known: ReadonlySet<string>): T {
  if (prev instanceof Y.Map) prev.forEach((v, k) => { if (!known.has(k) && !(v instanceof Y.AbstractType)) next.set(k, v); });
  return next;
}

export function yFolderFromPlain(folder: Folder): YFolder {
  const y: YFolder = new Y.Map();
  y.set("name", folder.name);
  y.set("color", folder.color);
  y.set("emoji", folder.emoji);
  y.set("parentId", folder.parentId);
  y.set("order", folder.order);
  y.set("createdAt", folder.createdAt);
  y.set("updatedAt", folder.updatedAt ?? folder.createdAt);
  if (folder.templateId) y.set("templateId", folder.templateId);
  return y;
}

export function plainFromYFolder(id: string, y: YFolder): Folder {
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
    ...(() => { const t = safeNullableString(y.get("templateId"), 100); return t ? { templateId: t } : {}; })(),
  };
}
