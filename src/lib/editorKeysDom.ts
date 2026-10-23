import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { TextControl } from "@/lib/textControl";
import {
  continueList, duplicateLines, indentList, insertLink, isListLineAt, moveLines, toggleWrap,
  type Edit,
} from "@/lib/editorKeys";

/**
 * Wstawia wynik czystej funkcji do textarea tak, by natywne Ctrl+Z je cofało:
 * zamienia tylko zmieniony środek przez `execCommand("insertText")` (zdarzenie
 * `input` leci samo, więc React dostaje `onChange`). Bez execCommand (jsdom,
 * część przeglądarek) — `setRangeText` + ręczne zdarzenie `input`.
 */
export function applyEdit(ta: TextControl, edit: Edit): void {
  const old = ta.value;
  if (edit.value !== old) {
    const next = edit.value;
    const min = Math.min(old.length, next.length);
    let p = 0;
    while (p < min && old[p] === next[p]) p++;
    let q = 0;
    while (q < min - p && old[old.length - 1 - q] === next[next.length - 1 - q]) q++;
    const from = p;
    const to = old.length - q;
    const insert = next.slice(p, next.length - q);

    if (!(ta instanceof HTMLTextAreaElement)) {
      // Adapter CM: jedna transakcja, którą cofa historia edytora.
      ta.setRangeText(insert, from, to, "end");
      ta.setSelectionRange(edit.selStart, edit.selEnd);
      return;
    }
    ta.setSelectionRange(from, to);
    let done = false;
    try {
      if (typeof document.execCommand === "function") {
        done = insert ? document.execCommand("insertText", false, insert) : to > from ? document.execCommand("delete") : true;
      }
    } catch {
      done = false;
    }
    if (!done || ta.value !== next) {
      // execCommand mógł zrobić część pracy — dopasuj do stanu docelowego.
      if (ta.value === old) ta.setRangeText(insert, from, to, "end");
      else ta.value = next;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  ta.setSelectionRange(edit.selStart, edit.selEnd);
}

/** Po `Esc` na linii listy następny Tab wychodzi z pola zamiast wcinać. */
let tabReleased = false;

export interface EditorKeyOptions {
  /** Ctrl/Cmd+Enter. Brak = skrót nie jest przechwytywany. */
  onSave?: () => void;
}

function consume(e: ReactKeyboardEvent) {
  e.preventDefault();
  // Ctrl+K nie może dojść do globalnej palety poleceń.
  e.stopPropagation();
}

/**
 * Obsługa skrótów edytora w `onKeyDown` textarea. Zwraca `true`, gdy zdarzenie
 * zostało obsłużone (wtedy nic więcej nie powinno go przetwarzać).
 * Podpowiedzi `[[` mają pierwszeństwo — wołaj to dopiero, gdy lista jest zamknięta
 * (albo z Ctrl/Cmd/Alt, których lista nie używa).
 */
export function handleEditorKey(e: ReactKeyboardEvent<Element>, ta: TextControl, opts: EditorKeyOptions = {}): boolean {
  if (e.nativeEvent.isComposing) return false;

  const { value, selectionStart: s, selectionEnd: end } = ta;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key;

  if (key !== "Tab" && key !== "Escape" && key !== "Shift" && key !== "Control" && key !== "Alt" && key !== "Meta") {
    tabReleased = false;
  }

  if (mod && !e.altKey) {
    const k = key.toLowerCase();
    if (k === "enter" && !e.shiftKey) {
      if (!opts.onSave) return false;
      consume(e);
      opts.onSave();
      return true;
    }
    if (e.shiftKey) return false;
    if (k === "b" || k === "i") {
      consume(e);
      applyEdit(ta, toggleWrap(value, s, end, k === "b" ? "**" : "*"));
      return true;
    }
    if (k === "k") {
      consume(e);
      applyEdit(ta, insertLink(value, s, end));
      return true;
    }
    return false;
  }

  if (e.altKey && !mod && (key === "ArrowUp" || key === "ArrowDown")) {
    const dir = key === "ArrowUp" ? "up" : "down";
    consume(e);
    if (e.shiftKey) applyEdit(ta, duplicateLines(value, s, end, dir));
    else {
      const r = moveLines(value, s, end, dir);
      if (r) applyEdit(ta, r);
    }
    return true;
  }

  if (e.altKey || mod) return false;

  if (key === "Enter" && !e.shiftKey) {
    const r = continueList(value, s, end);
    if (!r) return false;
    consume(e);
    applyEdit(ta, r);
    return true;
  }

  if (key === "Escape") {
    // Nie przechwytujemy Esc, tylko zwalniamy pułapkę Tab na linii listy.
    tabReleased = isListLineAt(value, s);
    return false;
  }

  if (key === "Tab") {
    if (tabReleased) { tabReleased = false; return false; }
    const r = indentList(value, s, end, e.shiftKey);
    if (!r) return false;
    consume(e);
    applyEdit(ta, r);
    return true;
  }

  return false;
}
