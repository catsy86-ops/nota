import { useState } from "react";
import { m as motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { emojiShower } from "@/lib/celebrate";
import { haptic } from "@/lib/haptics";
import { toastWithUndo } from "@/lib/undoToast";
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
    haptic(next.every((i) => i.checked) && items.some((i) => !i.checked) ? "success" : "selection");
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

  /** Alt+↑/↓ w polu pozycji: zamiana miejscami z sąsiednią nieukończoną pozycją. */
  /** Czy pozycja może się przesunąć (jest sąsiad wśród nieodhaczonych) — do wyłączania przycisków. */
  function canMove(id: string, dir: -1 | 1): boolean {
    const open = items.filter((i) => !i.checked);
    const at = open.findIndex((i) => i.id === id);
    return at !== -1 && !!open[at + dir];
  }

  function moveItem(id: string, dir: -1 | 1) {
    const open = items.filter((i) => !i.checked);
    const at = open.findIndex((i) => i.id === id);
    const other = open[at + dir];
    if (at === -1 || !other) return;
    const a = items.findIndex((i) => i.id === id);
    const b = items.findIndex((i) => i.id === other.id);
    const next = [...items];
    [next[a], next[b]] = [next[b], next[a]];
    onChange(next);
    // Przesunięty wiersz jest przemontowywany przez układ — oddaj fokus polu.
    setTimeout(() => {
      document.querySelector<HTMLInputElement>(`input[data-checklist-item="${id}"]`)?.focus();
    }, 0);
  }

  /**
   * Tab / Shift+Tab w polu pozycji: wcięcie pod poprzednią nieukończoną pozycją
   * albo cofnięcie wcięcia. Zwraca `false`, gdy nic się nie zmienia — wtedy Tab
   * normalnie przenosi fokus (nie łapiemy użytkownika klawiatury w polu).
   */
  function setIndent(id: string, indent: boolean): boolean {
    const at = items.findIndex((i) => i.id === id);
    if (at === -1) return false;
    const item = items[at];
    if (indent) {
      if (item.indent === 1) return false;
      // Wcinać można tylko pod istniejącą pozycją; pierwsza nieukończona nie ma pod czym.
      if (!items.slice(0, at).some((i) => !i.checked)) return false;
      onChange(items.map((i) => (i.id === id ? { ...i, indent: 1 as const } : i)));
    } else {
      if (item.indent !== 1) return false;
      onChange(items.map((i) => {
        if (i.id !== id) return i;
        const { indent: _drop, ...rest } = i;
        return rest;
      }));
    }
    return true;
  }

  function removeItem(id: string) {
    onChange(items.filter((i) => i.id !== id));
  }

  /** Nowy wiersz montuje się po przejściu wejścia, więc fokus ponawiamy przez kilka klatek. */
  const focusItem = (id: string) => {
    let tries = 0;
    const attempt = () => {
      const el = document.querySelector<HTMLInputElement>(`input[data-checklist-item="${id}"]`);
      if (el) { el.focus(); return; }
      if (++tries < 12) requestAnimationFrame(attempt);
    };
    requestAnimationFrame(attempt);
  };

  /** Enter w polu pozycji: nowa pozycja tuż pod nią (z tym samym wcięciem), fokus w niej. */
  function insertBelow(id: string) {
    const at = items.findIndex((i) => i.id === id);
    if (at === -1) return;
    const fresh: ChecklistItem = { id: crypto.randomUUID(), text: "", checked: false, ...(items[at].indent === 1 ? { indent: 1 as const } : {}) };
    onChange([...items.slice(0, at + 1), fresh, ...items.slice(at + 1)]);
    focusItem(fresh.id);
  }

  /** Backspace na pustej pozycji usuwa ją, a fokus wraca do poprzedniej. */
  function removeEmpty(id: string) {
    const open = items.filter((i) => !i.checked);
    const at = open.findIndex((i) => i.id === id);
    const prev = open[at - 1];
    removeItem(id);
    if (prev) focusItem(prev.id);
  }

  function clearChecked() {
    const before = items;
    const removed = items.filter((i) => i.checked).length;
    if (removed === 0) return;
    onChange(items.filter((i) => !i.checked));
    toastWithUndo(`Usunięto ukończone (${removed})`, () => onChange(before));
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
            className={cn("flex items-center gap-2 group/item", item.indent === 1 && "ml-6")}
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
                data-checklist-item={item.id}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    if (item.text.trim() === "") { setIndent(item.id, false); return; }
                    insertBelow(item.id);
                    return;
                  }
                  if (e.key === "Backspace" && item.text === "" && !e.altKey && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    removeEmpty(item.id);
                    return;
                  }
                  if (e.key === "Tab" && !e.altKey && !e.ctrlKey && !e.metaKey) {
                    if (setIndent(item.id, !e.shiftKey)) e.preventDefault();
                    return;
                  }
                  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
                  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                  e.preventDefault();
                  moveItem(item.id, e.key === "ArrowUp" ? -1 : 1);
                }}
                className="text-sm max-sm:text-base bg-transparent outline-hidden focus-visible:ring-2 focus-visible:ring-ring/60 rounded-sm text-foreground flex-1 min-w-0"
              />
            )}
            {!readOnly && !item.checked && (
              // Widoczne przesunięcie (bez przeciągania): na komputerze po najechaniu lub fokusie, na dotyku zawsze.
              <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/item:opacity-100 focus-within:opacity-100 coarse:opacity-100">
                {(["up", "down"] as const).map((dirName) => {
                  const dir = dirName === "up" ? -1 : 1;
                  const label = dirName === "up" ? "Przesuń w górę" : "Przesuń w dół";
                  const Icon = dirName === "up" ? ChevronUp : ChevronDown;
                  return (
                    <button
                      key={dirName}
                      type="button"
                      onClick={() => moveItem(item.id, dir)}
                      disabled={!canMove(item.id, dir)}
                      aria-label={`${label}: ${item.text || "pusta"}`}
                      title={label}
                      className="grid place-items-center rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 coarse:w-9"
                    >
                      <Icon className="w-3.5 h-3.5" aria-hidden />
                    </button>
                  );
                })}
              </span>
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                aria-label={`Usuń pozycję: ${item.text || "pusta"}`}
                className="p-0.5 coarse:p-2 rounded text-muted-foreground/40 hover:text-destructive-ink opacity-0 coarse:opacity-100 group-hover/item:opacity-100 focus-visible:opacity-100 transition-opacity outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {checked.length > 0 && (
        <div className="pt-1 border-t border-border/30 mt-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-2xs text-muted-foreground uppercase tracking-wider">
              {checked.length} ukończone
            </p>
            {!readOnly && (
              <button type="button" onClick={clearChecked}
                className="text-2xs coarse:text-xs text-muted-foreground hover:text-foreground rounded outline-hidden focus-visible:ring-2 focus-visible:ring-ring px-1 coarse:py-1">
                Usuń ukończone
              </button>
            )}
          </div>
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
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Usuń pozycję: ${item.text || "pusta"}`}
                  className="p-0.5 coarse:p-2 rounded text-muted-foreground/40 hover:text-destructive-ink opacity-0 coarse:opacity-100 group-hover/item:opacity-100 focus-visible:opacity-100 transition-opacity outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
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
            className="text-sm max-sm:text-base bg-transparent outline-hidden focus-visible:ring-2 focus-visible:ring-ring/60 rounded-sm text-foreground placeholder:text-muted-foreground flex-1 min-w-0"
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
  // Cztery odhaczone pozycje na początku nie mogą ukrywać otwartych zadań: nieukończone idą pierwsze.
  const ordered = [...items.filter((i) => !i.checked), ...items.filter((i) => i.checked)];

  return (
    <div className="mt-1">
      {ordered.slice(0, PREVIEW_ITEMS).map((item) => (
        // Cały wiersz jest polem wyboru: na dotyku cel ma szerokość kafla, nie 14 px.
        <button
          key={item.id}
          type="button"
          role="checkbox"
          aria-checked={item.checked}
          disabled={!onToggle}
          onClick={(e) => { e.stopPropagation(); onToggle?.(item.id); }}
          className={cn("group/check flex w-full items-center gap-2 rounded-control py-0.5 [@media(pointer:coarse)]:py-2.5 text-left disabled:cursor-default", item.indent === 1 && "pl-4")}
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
          <span className="text-2xs text-muted-foreground">{done}/{items.length}</span>
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
