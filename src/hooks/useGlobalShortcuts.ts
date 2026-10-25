import { toast } from "sonner";
import { useEffect } from "react";
import type { View } from "@/hooks/useFilteredNotes";
import { hasGridNavFocus } from "@/lib/gridKeyboardNav";
import { GO_CHORD_WINDOW_MS, viewForChord } from "@/lib/goChord";

export interface GlobalShortcutHandlers {
  onNewNote: () => void;
  /** Ctrl+, — ustawienia (konwencja przeglądarek i aplikacji). */
  onOpenSettings?: () => void;
  /** Alt+I — statystyki. */
  onOpenStats?: () => void;
  onFocusSearch?: () => void;
  onGoToday: () => void;
  onGoWeek: () => void;
  /** Sekwencja „g” + litera (zob. goChord.ts). */
  onGoView?: (view: View) => void;
  onEasterEgg: () => void;
  onEscapeSelection: () => void;
  hasSelection: () => boolean;
  onUndo: () => void;
  onRedo?: () => void;
  onCloseSidebar: () => void;
  isSidebarOpen: () => boolean;
  onOpenShortcuts: () => void;
  onTogglePalette: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target as HTMLElement | null)?.isContentEditable === true;
}

const SEARCH_SELECTOR = 'input[type="search"], input[placeholder*="zukaj" i], input[placeholder*="earch" i]';

/** Pierwsze widoczne pole wyszukiwania (na telefonie część pól jest ukryta — `offsetParent` wyklucza je). */
function findVisibleSearchInput(): HTMLInputElement | null {
  return Array.from(document.querySelectorAll<HTMLInputElement>(SEARCH_SELECTOR)).find((el) => el.offsetParent !== null) ?? null;
}

function focusSearchInput(): boolean {
  const el = findVisibleSearchInput();
  if (el) el.focus();
  return el !== null;
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
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === ",") {
        e.preventDefault();
        handlers.onOpenSettings?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);

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
      if (key === "i") { e.preventDefault(); handlers.onOpenStats?.(); }
      else if (key === "t") { e.preventDefault(); handlers.onGoToday(); }
      else if (key === "w") { e.preventDefault(); handlers.onGoWeek(); }
      else if (key === "n") { e.preventDefault(); handlers.onNewNote(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);

  // "/" focuses search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && !isTypingTarget(e.target)) {
        const el = findVisibleSearchInput();
        if (el) { e.preventDefault(); el.focus(); }
        else toast.info("Na tym ekranie nie ma wyszukiwania");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // „g”, a po nim litera - przejście do widoku (g n, g d, g k ...). Nie działa
  // w polach tekstowych, z modyfikatorami, przy otwartym dialogu ani gdy kafel
  // ma fokus siatki (tam A/P/D to akcje na notatce).
  useEffect(() => {
    let armedAt = 0;
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) { armedAt = 0; return; }
      if (e.key.length !== 1) return; // same modyfikatory (Shift) nie rozbrajają
      const blocked = hasGridNavFocus() || !!document.querySelector('[role="dialog"][data-state="open"]');
      if (armedAt && Date.now() - armedAt <= GO_CHORD_WINDOW_MS) {
        armedAt = 0;
        const view = viewForChord(e.key);
        if (view && !blocked) { e.preventDefault(); handlers.onGoView?.(view); }
        return;
      }
      armedAt = e.key === "g" && !blocked ? Date.now() : 0;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);

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
  }, [handlers]);

  // Escape clears selection
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && handlers.hasSelection()) { e.preventDefault(); handlers.onEscapeSelection(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);

  // Ctrl/Cmd+Z — undo the last trash/archive move
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.key.toLowerCase() !== "z") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      if (e.shiftKey) handlers.onRedo?.();
      else handlers.onUndo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);

  // Ctrl/Cmd+K — toggle the command palette. Kept here (rather than inside
  // CommandPalette itself) so the shortcut works even before the palette's
  // own lazy-loaded chunk has ever been mounted.
  // W edytorze tresci (textarea) Ctrl+K wstawia link: `editorKeysDom` woła
  // preventDefault + stopPropagation, wiec tu zdarzenie juz nie dociera;
  // `defaultPrevented` to drugie zabezpieczenie.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        handlers.onTogglePalette();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);

  // "?" opens the keyboard shortcuts cheat sheet
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "?" && !isTypingTarget(e.target)) {
        e.preventDefault();
        handlers.onOpenShortcuts();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);

  // Esc — close the topmost open overlay (panels that are not Radix dialogs)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      if (handlers.isSidebarOpen()) { e.preventDefault(); handlers.onCloseSidebar(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);
}
