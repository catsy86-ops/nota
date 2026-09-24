import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X } from "lucide-react";
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
              onClick={() => toggleItem(item.id)}
              className="w-4 h-4 rounded border-2 border-muted-foreground/40 hover:border-primary transition-colors shrink-0"
            />
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
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">
            {checked.length} ukończone
          </p>
          {checked.map((item) => (
            <div key={item.id} className="flex items-center gap-2 group/item">
              <button
                onClick={() => toggleItem(item.id)}
                className="w-4 h-4 rounded border-2 border-primary bg-primary/20 flex items-center justify-center shrink-0"
              >
                <div className="w-2 h-2 rounded-sm bg-primary" />
              </button>
              <span className="text-sm text-muted-foreground/50 line-through flex-1">{item.text}</span>
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
    <div className="space-y-1 mt-2">
      {items.slice(0, 5).map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onToggle?.(item.id); }}
            className={cn(
              "w-3.5 h-3.5 rounded border-[1.5px] shrink-0 transition-colors",
              item.checked ? "border-primary bg-primary/20" : "border-muted-foreground/40"
            )}
          >
            {item.checked && <div className="w-1.5 h-1.5 rounded-sm bg-primary mx-auto" />}
          </button>
          <span className={cn("text-xs", item.checked ? "text-muted-foreground/40 line-through" : "text-foreground/70")}>
            {item.text}
          </span>
        </div>
      ))}
      {items.length > 5 && (
        <p className="text-[10px] text-muted-foreground/50 pl-5">+{items.length - 5} więcej</p>
      )}
      {done > 0 && (
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${(done / items.length) * 100}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground/50">{done}/{items.length}</span>
        </div>
      )}
    </div>
  );
}
