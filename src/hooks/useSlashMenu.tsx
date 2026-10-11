import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { caretCoordinates } from "@/lib/textareaCaret";
import { applyEdit } from "@/lib/editorKeysDom";
import {
  applySlashCommand, filterSlashCommands, slashQueryAt, type SlashCommand, type SlashQuery,
} from "@/lib/slashMenu";

interface Options {
  textareaRef: RefObject<HTMLTextAreaElement>;
  /** Bieżący tekst — zmiana (też z zewnątrz) odświeża menu. */
  value: string;
  /** Gdy inna lista podpowiedzi (np. `[[`) jest otwarta, menu „/” się nie pokazuje. */
  disabled?: boolean;
}

interface OpenQuery {
  q: SlashQuery;
  caret: number;
  top: number;
  left: number;
  lineHeight: number;
}

const ITEM_H = 44;
const POPUP_W = 256;
const MAX_VISIBLE = 6;

/**
 * Menu bloków po wpisaniu `/`: strzałki wybierają, Enter/Tab wstawia, Esc chowa menu
 * do czasu, aż zacznie się nowy ukośnik. Lista jest pozycjonowana przy karetce,
 * wewnątrz kontenera pola z `position: relative` (tak jak podpowiedzi `[[`).
 */
export function useSlashMenu({ textareaRef, value, disabled = false }: Options) {
  const [open, setOpen] = useState<OpenQuery | null>(null);
  const [active, setActive] = useState(0);
  const dismissedAt = useRef<number | null>(null);

  const refresh = useCallback(() => {
    const ta = textareaRef.current;
    if (disabled || !ta || ta.selectionStart !== ta.selectionEnd) { setOpen(null); return; }
    const caret = ta.selectionStart;
    const q = slashQueryAt(ta.value, caret);
    if (!q) { dismissedAt.current = null; setOpen(null); return; }
    if (dismissedAt.current === q.start) { setOpen(null); return; }
    const c = caretCoordinates(ta, caret);
    setOpen((prev) =>
      prev && prev.caret === caret && prev.q.start === q.start && prev.q.query === q.query
        ? prev
        : { q, caret, top: ta.offsetTop + c.top, left: ta.offsetLeft + c.left, lineHeight: c.height });
  }, [textareaRef, disabled]);

  useEffect(() => { refresh(); }, [value, refresh]);
  const queryKey = open ? `${open.q.start}:${open.q.query}` : "";
  useEffect(() => { setActive(0); }, [queryKey]);

  const query = open?.q.query ?? null;
  const commands = useMemo(
    () => (query === null ? [] : filterSlashCommands(query)),
    [query],
  );
  const isOpen = !!open && commands.length > 0;

  const pick = useCallback((cmd: SlashCommand) => {
    const ta = textareaRef.current;
    if (!ta || !open) return;
    ta.focus();
    applyEdit(ta, applySlashCommand(ta.value, open.q, open.caret, cmd));
    setOpen(null);
  }, [textareaRef, open]);

  const dismiss = useCallback(() => {
    if (open) dismissedAt.current = open.q.start;
    setOpen(null);
  }, [open]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isOpen || e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const d = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + d + commands.length) % commands.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(commands[Math.min(active, commands.length - 1)]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      dismiss();
    }
  }, [isOpen, commands, active, pick, dismiss]);

  function popup() {
    if (!open || !isOpen) return null;
    const visible = Math.min(commands.length, MAX_VISIBLE);
    const height = visible * ITEM_H + 8;
    const above = open.top > height + 8;
    const top = above ? open.top - height - 2 : open.top + open.lineHeight + 2;
    const containerWidth = (textareaRef.current?.offsetParent as HTMLElement | null)?.clientWidth ?? Infinity;
    const maxLeft = Math.max(0, containerWidth - POPUP_W - 4);
    return (
      <div
        role="listbox"
        aria-label="Wstaw blok"
        className="absolute z-30 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg py-1"
        style={{ top, left: Math.min(open.left, maxLeft), width: POPUP_W, maxWidth: "calc(100% - 4px)", maxHeight: height }}
        // Fokus zostaje w polu — inaczej `onBlur` edytora zapisałby notatkę w pół słowa.
        onMouseDown={(e) => e.preventDefault()}
      >
        {commands.map((c, i) => (
          <button
            key={c.id}
            type="button"
            role="option"
            aria-selected={i === active}
            ref={(el) => { if (el && i === active) el.scrollIntoView({ block: "nearest" }); }}
            onClick={() => pick(c)}
            onMouseEnter={() => setActive(i)}
            className={cn(
              "w-full text-left px-3 transition-colors flex flex-col justify-center",
              i === active ? "bg-primary/10" : "hover:bg-muted",
            )}
            style={{ height: ITEM_H }}
          >
            <span className={cn("text-sm font-medium leading-tight truncate", i === active && "text-primary-ink")}>{c.label}</span>
            <span className="text-2xs text-muted-foreground truncate font-mono">{c.hint}</span>
          </button>
        ))}
      </div>
    );
  }

  return { isOpen, dismiss, refresh, onKeyDown, popup };
}
