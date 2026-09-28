import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { emojiShower } from "@/lib/celebrate";

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

interface ChecklistEditorProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  readOnly?: boolean;
}

/** Wspólny wygląd pola wyboru listy: pusty kwadrat albo wypełniony z ✓. */
function CheckMark({ checked, size = "md" }: { checked: boolean; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "rounded flex items-center justify-center shrink-0 border-[1.5px] transition-colors",
        size === "sm" ? "w-4 h-4" : "w-[18px] h-[18px]",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50 group-hover/check:border-primary",
      )}
    >
      {checked && <Check className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} strokeWidth={3} />}
    </span>
  );
}

export function ChecklistEditor({ items, onChange, readOnly }: ChecklistEditorProps) {
  const [newItem, setNewItem] = useState("");

  function addItem() {
    const text = newItem.trim();
    if (!text) return;
    onChange([...items, { id: crypto.randomUUID(), text, checked: false }]);
    setNewItem("");
  }

  function toggleItem(id: string) {
    const next = items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i));
    onChange(next);
    if (next.length > 0 && next.every((i) => i.checked) && items.some((i) => !i.checked)) {
      emojiShower(["🎉", "✅", "✨", "🥳"]);
    }
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
                <CheckMark checked />
              </button>
              <span className="text-sm text-muted-foreground line-through decoration-muted-foreground/60 flex-1">{item.text}</span>
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
            placeholder="Dodaj element..."
            className="text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground/40 flex-1 min-w-0"
          />
        </div>
      )}
    </div>
  );
}

export function ChecklistPreview({ items, onToggle }: { items: ChecklistItem[]; onToggle?: (id: string) => void }) {
  if (!items.length) return null;
  const done = items.filter((i) => i.checked).length;
  
  return (
    <div className="mt-2">
      {items.slice(0, 5).map((item) => (
        // Cały wiersz jest polem wyboru: na dotyku cel ma szerokość kafla, nie 14 px.
        <button
          key={item.id}
          type="button"
          role="checkbox"
          aria-checked={item.checked}
          disabled={!onToggle}
          onClick={(e) => { e.stopPropagation(); onToggle?.(item.id); }}
          className="group/check flex w-full items-center gap-2 rounded-md py-1 [@media(pointer:coarse)]:py-1.5 text-left disabled:cursor-default"
        >
          <CheckMark checked={item.checked} size="sm" />
          <span className={cn("text-xs", item.checked ? "text-muted-foreground line-through decoration-muted-foreground/60" : "text-foreground/80")}>
            {item.text}
          </span>
        </button>
      ))}
      {items.length > 5 && (
        <p className="text-2xs text-muted-foreground/50 pl-5">+{items.length - 5} więcej</p>
      )}
      {done > 0 && (
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
