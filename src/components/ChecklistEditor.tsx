import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { emojiShower } from "@/lib/celebrate";
import { checklistToContent, contentToChecklist, parsePastedChecklist } from "@/lib/checklistPaste";
import type { ChecklistItem } from "@/hooks/useNotes";

export type { ChecklistItem };

interface ChecklistEditorProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  readOnly?: boolean;
}

/**
 * Wspólny wygląd pola wyboru listy: pusty kwadrat albo wypełniony z ptaszkiem.
 * Ptaszek jest rysowany (stroke-dashoffset, klasy `check-tick` w index.css):
 * przy przełączeniu w miejscu gra przejście CSS, a `drawIn` — gdy wiersz
 * dopiero się zamontował po odhaczeniu (edytor przenosi go do „ukończonych”).
 * Bez animacji przy zwykłym montażu, więc 150 kafli nie rysuje ptaszków naraz.
 */
function CheckMark({ checked, size = "md", drawIn }: { checked: boolean; size?: "sm" | "md"; drawIn?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "rounded flex items-center justify-center shrink-0 border-[1.5px] transition-colors duration-fast",
        size === "sm" ? "w-4 h-4" : "w-[18px] h-[18px]",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50 group-hover/check:border-primary",
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
        className={cn(size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5", "check-tick", drawIn && "check-tick-in")} data-on={checked}>
        {/* Od krótkiego ramienia — ptaszek „pisany” jak długopisem. */}
        <path d="M4 12l5 5L20 6" pathLength={1} />
      </svg>
    </span>
  );
}

/** Tekst pozycji z przekreśleniem, które przesuwa się przez tekst przy odhaczeniu. */
function StrikeText({ checked, drawIn, children }: { checked: boolean; drawIn?: boolean; children: React.ReactNode }) {
  // Wewnętrzny inline span: każda linia zawiniętego tekstu dostaje własną kreskę.
  return <span className={cn("check-strike", drawIn && "check-strike-in")} data-on={checked}>{children}</span>;
}

export function ChecklistEditor({ items, onChange, readOnly }: ChecklistEditorProps) {
  const [newItem, setNewItem] = useState("");
  // Ostatnio odhaczona pozycja: jej wiersz w „ukończonych” montuje się na nowo,
  // więc ptaszek i kreskę gra animacja wejścia, nie przejście.
  const [justChecked, setJustChecked] = useState<string | null>(null);

  function addItem() {
    const text = newItem.trim();
    if (!text) return;
    onChange([...items, { id: crypto.randomUUID(), text, checked: false }]);
    setNewItem("");
  }

  function toggleItem(id: string) {
    const next = items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i));
    setJustChecked(next.find((i) => i.id === id)?.checked ? id : null);
    onChange(next);
    if (next.length > 0 && next.every((i) => i.checked) && items.some((i) => !i.checked)) {
      emojiShower(["🎉", "✅", "✨", "🥳"]);
    }
  }

  /** Wklejone kilka linii = kilka pozycji, wstawionych za `afterId` (albo na koniec). */
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, afterId?: string) {
    const parsed = parsePastedChecklist(e.clipboardData.getData("text"));
    if (!parsed) return;
    e.preventDefault();
    const added = parsed.map((p) => ({ ...p, id: crypto.randomUUID() }));
    if (!afterId) {
      // Tekst już wpisany w polu staje się początkiem pierwszej pozycji.
      const typed = newItem.trim();
      if (typed && added.length) added[0] = { ...added[0], text: `${typed} ${added[0].text}` };
      onChange([...items, ...added]);
      setNewItem("");
      return;
    }
    const at = items.findIndex((i) => i.id === afterId) + 1;
    onChange([...items.slice(0, at), ...added, ...items.slice(at)]);
  }

  function removeItem(id: string) {
    onChange(items.filter((i) => i.id !== id));
  }

  function updateText(id: string, text: string) {
    onChange(items.map((i) => (i.id === id ? { ...i, text } : i)));
  }

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  return (
    <div className="space-y-1">
      <AnimatePresence mode="popLayout">
        {unchecked.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 group/item"
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={false}
              aria-label={`Odhacz: ${item.text || "element"}`}
              onClick={() => toggleItem(item.id)}
              className="group/check p-1 -m-1"
            >
              <CheckMark checked={false} />
            </button>
            {readOnly ? (
              <span className="text-sm text-foreground flex-1">{item.text}</span>
            ) : (
              <input
                value={item.text}
                onChange={(e) => updateText(item.id, e.target.value)}
                onPaste={(e) => handlePaste(e, item.id)}
                className="text-sm bg-transparent outline-none text-foreground flex-1 min-w-0"
              />
            )}
            {!readOnly && (
              <button
                onClick={() => removeItem(item.id)}
                className="p-0.5 rounded text-muted-foreground/40 hover:text-destructive opacity-0 group-hover/item:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {checked.length > 0 && (
        <div className="pt-1 border-t border-border/30 mt-2">
          <p className="text-2xs text-muted-foreground/50 uppercase tracking-wider mb-1">
            {checked.length} ukończone
          </p>
          {checked.map((item) => (
            <div key={item.id} className="flex items-center gap-2 group/item">
              <button
                type="button"
                role="checkbox"
                aria-checked
                aria-label={`Odznacz: ${item.text || "element"}`}
                onClick={() => toggleItem(item.id)}
                className="group/check p-1 -m-1"
              >
                <CheckMark checked drawIn={item.id === justChecked} />
              </button>
              <span className="text-sm text-muted-foreground flex-1">
                <StrikeText checked drawIn={item.id === justChecked}>{item.text}</StrikeText>
              </span>
              {!readOnly && (
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-0.5 rounded text-muted-foreground/40 hover:text-destructive opacity-0 group-hover/item:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="flex items-center gap-2 pt-1">
          <Plus className="w-4 h-4 text-muted-foreground/40 shrink-0" />
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            onPaste={(e) => handlePaste(e)}
            placeholder="Dodaj element..."
            className="text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground/40 flex-1 min-w-0"
          />
        </div>
      )}
    </div>
  );
}

/** Na kaflu cztery pozycje — reszta w czytniku i edytorze. */
const PREVIEW_ITEMS = 4;

/** Postęp listy „2/5” — kafel z tytułem pokazuje go obok tytułu zamiast paska pod listą. */
export function ChecklistCount({ items }: { items: ChecklistItem[] }) {
  if (!items.length) return null;
  const done = items.filter((i) => i.checked).length;
  return (
    <span className="ml-1.5 align-baseline font-body text-2xs font-medium tabular-nums text-muted-foreground" aria-label={`Zrobione ${done} z ${items.length}`}>
      {done}/{items.length}
    </span>
  );
}

export function ChecklistPreview({ items, onToggle, showProgress = true }: { items: ChecklistItem[]; onToggle?: (id: string) => void; showProgress?: boolean }) {
  if (!items.length) return null;
  const done = items.filter((i) => i.checked).length;
  
  return (
    <div className="mt-1">
      {items.slice(0, PREVIEW_ITEMS).map((item) => (
        // Cały wiersz jest polem wyboru: na dotyku cel ma szerokość kafla, nie 14 px.
        <button
          key={item.id}
          type="button"
          role="checkbox"
          aria-checked={item.checked}
          disabled={!onToggle}
          onClick={(e) => { e.stopPropagation(); onToggle?.(item.id); }}
          className="group/check flex w-full items-center gap-2 rounded-md py-0.5 [@media(pointer:coarse)]:py-1 text-left disabled:cursor-default"
        >
          <CheckMark checked={item.checked} size="sm" />
          <span className={cn("text-xs transition-colors duration-base", item.checked ? "text-muted-foreground" : "text-foreground/80")}>
            <StrikeText checked={item.checked}>{item.text}</StrikeText>
          </span>
        </button>
      ))}
      {items.length > PREVIEW_ITEMS && (
        <p className="text-2xs text-muted-foreground pl-5">+{items.length - PREVIEW_ITEMS} więcej</p>
      )}
      {showProgress && done > 0 && (
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${(done / items.length) * 100}%` }} />
          </div>
          <span className="text-2xs text-muted-foreground/50">{done}/{items.length}</span>
        </div>
      )}
    </div>
  );
}

/** „Zamień na listę” (gdy jest treść) i „Zamień na tekst” (gdy są pozycje). `toList` mówi, czy pokazać listę. */
export function ChecklistConvertButtons({ content, checklist, onConvert }: {
  content: string;
  checklist: ChecklistItem[];
  onConvert: (result: { content: string; checklist: ChecklistItem[] }, toList: boolean) => void;
}) {
  const cls = "text-xs text-muted-foreground hover:text-foreground transition-colors";
  return (
    <>
      {content.trim() && (
        <button type="button" className={cls} onClick={() => onConvert(contentToChecklist(content, checklist), true)}>
          Zamień na listę
        </button>
      )}
      {checklist.length > 0 && (
        <button type="button" className={cls} onClick={() => onConvert(checklistToContent(content, checklist), false)}>
          Zamień na tekst
        </button>
      )}
    </>
  );
}
