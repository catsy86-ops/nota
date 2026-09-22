import { useEffect } from "react";

export interface GlobalShortcutHandlers {
  onNewNote: () => void;
  onFocusSearch?: () => void;
  onGoToday: () => void;
  onGoWeek: () => void;
  onEasterEgg: () => void;
  onEscapeSelection: () => void;
  hasSelection: () => boolean;
  onUndo: () => void;
  onCloseSidebar: () => void;
  isSidebarOpen: () => boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target as HTMLElement | null)?.isContentEditable === true;
}

function focusSearchInput() {
  const el = document.querySelector<HTMLInputElement>('input[type="search"], input[placeholder*="zukaj" i], input[placeholder*="earch" i]');
  if (el) el.focus();
}

/** Wires up every global keyboard shortcut used across the app. */
export function useGlobalShortcuts(handlers: GlobalShortcutHandlers) {
  // Ctrl/Cmd+N — new note
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        handlers.onNewNote();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers.onNewNote]);

  // Alt+S search, Alt+T today, Alt+W week, Alt+N new note
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const inField = isTypingTarget(e.target);
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        focusSearchInput();
        return;
      }
      if (inField) return;
      if (key === "t") { e.preventDefault(); handlers.onGoToday(); }
      else if (key === "w") { e.preventDefault(); handlers.onGoWeek(); }
      else if (key === "n") { e.preventDefault(); handlers.onNewNote(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers.onGoToday, handlers.onGoWeek, handlers.onNewNote]);

  // "/" focuses search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && !isTypingTarget(e.target)) {
        const el = document.querySelector<HTMLInputElement>('input[type="search"], input[placeholder*="zukaj" i], input[placeholder*="earch" i]');
        if (el) { e.preventDefault(); el.focus(); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Konami code easter egg ↑↑↓↓←→←→BA
  useEffect(() => {
    const sequence = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
    let buf: string[] = [];
    function onKey(e: KeyboardEvent) {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      buf.push(k);
      if (buf.length > sequence.length) buf = buf.slice(-sequence.length);
      if (buf.length === sequence.length && buf.every((v, i) => v === sequence[i])) {
        buf = [];
        handlers.onEasterEgg();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers.onEasterEgg]);

  // Escape clears selection
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && handlers.hasSelection()) { e.preventDefault(); handlers.onEscapeSelection(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers.hasSelection, handlers.onEscapeSelection]);

  // Ctrl/Cmd+Z — undo the last trash/archive move
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== "z") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      handlers.onUndo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers.onUndo]);

  // Esc — close the topmost open overlay (panels that are not Radix dialogs)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      if (handlers.isSidebarOpen()) { e.preventDefault(); handlers.onCloseSidebar(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers.isSidebarOpen, handlers.onCloseSidebar]);
}
