import * as Y from "yjs";
import type { Folder } from "@/lib/types/note";
import { cleanPropDefs, type PropDef } from "@/lib/noteProps";
import { cleanLabelPath, isUnderLabel, renameLabelBranch } from "@/lib/labelTree";
import {
  FOLDER_SCALAR_FIELDS, yPropDefFromPlain, plainPropDefFromY, FOLDER_KEYS, PROP_DEF_KEYS, keepForeignKeys,
  yFolderFromPlain, plainFromYFolder,
} from "./codec";
import type { StoreCtx } from "./context";

/**
 * Foldery, etykiety i definicje właściwości (F3, krok 6): projekcje i zapisy. Zmiana i usunięcie etykiety albo
 * definicji przechodzą też po notatkach — w jednej transakcji.
 */

export function createTaxonomyApi(ctx: StoreCtx) {
  const { doc, notesMap, foldersMap, labelsMap, propDefsMap } = ctx;

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
      propDefsMap.set(def.id, keepForeignKeys(propDefsMap.get(def.id), yPropDefFromPlain(def), PROP_DEF_KEYS));
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

  function upsertFolder(folder: Folder): void {
    doc.transact(() => { foldersMap.set(folder.id, keepForeignKeys(foldersMap.get(folder.id), yFolderFromPlain(folder), FOLDER_KEYS)); });
  }

  function patchFolder(id: string, updates: Partial<Omit<Folder, "id" | "createdAt">>): void {
    const y = foldersMap.get(id);
    if (!y) return;
    doc.transact(() => {
      for (const field of FOLDER_SCALAR_FIELDS) {
        if (!(field in updates)) continue;
        const value = (updates as Record<string, unknown>)[field];
        // `undefined` = zdjęcie pola (np. domyślnego szablonu, 5.9), nie zapis „undefined” do dokumentu.
        if (value === undefined) y.delete(field);
        else y.set(field, value);
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

  return { projectFolders, projectLabels, projectPropDefs, upsertPropDef, deletePropDef, upsertFolder, patchFolder, removeFolder, addLabel, removeLabelEverywhere, renameLabelEverywhere };
}
