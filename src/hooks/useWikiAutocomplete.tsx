import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { getCaretCoords, type TextControl } from "@/lib/textControl";
import { completeWikiLink, suggestWikiTitles, wikiQueryAt, type WikiQuery } from "@/lib/wikiLinks";
import { completeMention, mentionQueryAt, suggestMentions, type MentionItem } from "@/lib/mentions";

interface Options {
  textareaRef: RefObject<TextControl | null>;
  value: string;
  onChange: (text: string) => void;
  /** Tytuły do podpowiedzi (`WikiIndex.titles`). */
  titles: string[];
  /** Tytuł edytowanej notatki — link do samej siebie nie ma sensu. */
  exclude: string;
  /**
   * Zapytanie po `@`, które należy do czegoś innego niż wzmianka (np. nazwa folderu
   * w pasku nowej notatki) — wtedy lista wzmianek się nie otwiera.
   */
  skipMention?: (query: string) => boolean;
}

interface OpenQuery {
  /** `wiki` — po `[[`, `mention` — po `@` (daty i notatki). */
  kind: "wiki" | "mention";
  q: WikiQuery;
  caret: number;
  /** Karetka względem lewego górnego rogu kontenera (`offsetParent` pola). */
  top: number;
  left: number;
  lineHeight: number;
}

const ITEM_H = 30;
const POPUP_W = 224;

/**
 * Podpowiedzi tytułów po wpisaniu `[[` oraz @-wzmianki (daty i ostatnio edytowane
 * notatki) po wpisaniu `@`: strzałki wybierają, Enter/Tab wstawia
 * `[[Tytuł]]` albo datę, Esc chowa listę do czasu, aż zacznie się inne zapytanie.
 * Lista jest pozycjonowana przy karetce, wewnątrz kontenera pola z `position: relative`.
 */
export function useWikiAutocomplete({ textareaRef, value, onChange, titles, exclude, skipMention }: Options) {
  const [open, setOpen] = useState<OpenQuery | null>(null);
  const [active, setActive] = useState(0);
  const dismissedAt = useRef<number | null>(null);

  const refresh = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta || ta.selectionStart !== ta.selectionEnd) { setOpen(null); return; }
    const caret = ta.selectionStart;
    const wiki = wikiQueryAt(ta.value, caret);
    const q = wiki ?? mentionQueryAt(ta.value, caret);
    const kind = wiki ? "wiki" : "mention";
    if (!q) { dismissedAt.current = null; setOpen(null); return; }
    if (dismissedAt.current === q.start) { setOpen(null); return; }
    const c = getCaretCoords(ta, caret);
    setOpen((prev) =>
      prev && prev.caret === caret && prev.kind === kind && prev.q.start === q.start && prev.q.query === q.query
        ? prev
        : { kind, q, caret, top: ta.offsetTop + c.top, left: ta.offsetLeft + c.left, lineHeight: c.height });
  }, [textareaRef]);

  // Tekst zmienia się też bez klawiatury (przycisk „Link do notatki”, tekst peera).
  useEffect(() => { refresh(); }, [value, refresh]);
  // Nowe zapytanie = nowa lista, zaznaczenie wraca na pierwszą pozycję.
  const queryKey = open ? `${open.q.start}:${open.q.query}` : "";
  useEffect(() => { setActive(0); }, [queryKey]);

  const query = open?.q.query ?? null;
  const kind = open?.kind ?? null;
  const suggestions = useMemo<MentionItem[]>(() => {
    if (query === null) return [];
    if (kind === "mention") return skipMention?.(query) ? [] : suggestMentions(query, titles, exclude);
    return suggestWikiTitles(query, titles, exclude).map((t) => ({ key: t, label: t, hint: "notatka" as const, text: `[[${t}]]` }));
  }, [query, kind, titles, exclude, skipMention]);
  const isOpen = suggestions.length > 0;

  const pick = useCallback((item: MentionItem) => {
    const ta = textareaRef.current;
    if (!ta || !open) return;
    const next = open.kind === "mention"
      ? completeMention(ta.value, open.q, open.caret, item.text)
      : completeWikiLink(ta.value, open.q, open.caret, item.label);
    onChange(next.text);
    setOpen(null);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(next.caret, next.caret); }, 0);
  }, [textareaRef, open, onChange]);

  const dismiss = useCallback(() => {
    if (open) dismissedAt.current = open.q.start;
    setOpen(null);
  }, [open]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<Element>) => {
    if (!isOpen) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const d = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + d + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(suggestions[Math.min(active, suggestions.length - 1)]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      dismiss();
    }
  }, [isOpen, suggestions, active, pick, dismiss]);

  const textareaProps = {
    onKeyDown,
    onSelect: refresh,
    "aria-autocomplete": "list" as const,
    "aria-expanded": isOpen,
  };

  function popup() {
    if (!open || !isOpen) return null;
    const height = suggestions.length * ITEM_H + 8;
    // Nad karetką, gdy pod nią zabrakłoby miejsca w karcie (karta ucina nadmiar).
    const above = open.top > height + 8;
    const top = above ? open.top - height - 2 : open.top + open.lineHeight + 2;
    const containerWidth = (textareaRef.current?.offsetParent as HTMLElement | null)?.clientWidth ?? Infinity;
    const maxLeft = Math.max(0, containerWidth - POPUP_W - 4);
    return (
      <div
        role="listbox"
        aria-label={open.kind === "mention" ? "Wzmianki: daty i notatki" : "Podpowiedzi linków do notatek"}
        className="absolute z-30 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg py-1"
        style={{ top, left: Math.min(open.left, maxLeft), width: POPUP_W, maxWidth: "calc(100% - 4px)" }}
        // Fokus zostaje w polu — inaczej `onBlur` edytora zapisałby w pół słowa.
        onMouseDown={(e) => e.preventDefault()}
      >
        {suggestions.map((t, i) => (
          <button
            key={t.key}
            type="button"
            role="option"
            aria-selected={i === active}
            onClick={() => pick(t)}
            onMouseEnter={() => setActive(i)}
            className={cn(
              "w-full flex items-center gap-2 text-left px-3 text-sm transition-colors",
              i === active ? "bg-primary/10 text-primary-ink" : "hover:bg-muted",
            )}
            style={{ height: ITEM_H }}
          >
            <span className="truncate flex-1">{t.label}</span>
            {open.kind === "mention" && <span className="shrink-0 text-2xs text-muted-foreground">{t.hint}</span>}
          </button>
        ))}
      </div>
    );
  }

  return { isOpen, dismiss, textareaProps, popup };
}
