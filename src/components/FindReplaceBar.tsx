import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { findMatches, replaceAll, replaceAt } from "@/lib/findReplace";
import { cn } from "@/lib/utils";

interface FindReplaceBarProps {
  value: string;
  onChange: (value: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onClose: () => void;
}

const FIELD = "h-8 coarse:h-10 min-w-0 flex-1 rounded-md border border-border/60 bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const BTN = "pressable h-8 coarse:h-10 px-2 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Pasek „Znajdź i zamień” nad treścią edytowanej notatki (Ctrl+F / Ctrl+H w polu treści). */
export function FindReplaceBar({ value, onChange, textareaRef, onClose }: FindReplaceBarProps) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [current, setCurrent] = useState(0);
  const findRef = useRef<HTMLInputElement>(null);

  // Zaznaczone słowo w treści od razu trafia do pola szukania.
  useEffect(() => {
    const ta = textareaRef.current;
    const sel = ta ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : "";
    if (sel && !sel.includes("\n")) setQuery(sel);
    findRef.current?.focus();
    findRef.current?.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matches = useMemo(() => findMatches(value, query, { caseSensitive: matchCase }), [value, query, matchCase]);
  const index = matches.length ? Math.min(current, matches.length - 1) : -1;

  function reveal(i: number) {
    const ta = textareaRef.current;
    if (!ta || matches.length === 0) return;
    const at = matches[i];
    ta.setSelectionRange(at, at + query.length);
    // `setSelectionRange` nie przewija — ustawiamy pozycję wg numeru linii.
    const line = value.slice(0, at).split("\n").length - 1;
    const total = value.split("\n").length;
    ta.scrollTop = Math.max(0, (line / total) * ta.scrollHeight - ta.clientHeight / 2);
  }

  function go(step: 1 | -1) {
    if (matches.length === 0) return;
    const next = (index + step + matches.length) % matches.length;
    setCurrent(next);
    reveal(next);
  }

  function replaceCurrent() {
    if (index < 0) return;
    onChange(replaceAt(value, matches[index], query.length, replacement));
  }

  function replaceEvery() {
    const r = replaceAll(value, query, replacement, { caseSensitive: matchCase });
    if (r.count > 0) onChange(r.text);
  }

  return (
    <div role="search" aria-label="Znajdź i zamień w notatce" className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 p-1.5"
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); textareaRef.current?.focus(); } }}>
      <input ref={findRef} value={query} onChange={(e) => { setQuery(e.target.value); setCurrent(0); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(e.shiftKey ? -1 : 1); } }}
        placeholder="Znajdź" aria-label="Znajdź" className={FIELD} />
      <span aria-live="polite" className="text-xs text-muted-foreground tabular-nums min-w-14 text-center">
        {query ? (matches.length ? `${index + 1} z ${matches.length}` : "brak") : ""}
      </span>
      <button type="button" className={BTN} onClick={() => go(-1)} disabled={matches.length === 0} aria-label="Poprzednie trafienie"><ChevronUp className="w-4 h-4" /></button>
      <button type="button" className={BTN} onClick={() => go(1)} disabled={matches.length === 0} aria-label="Następne trafienie"><ChevronDown className="w-4 h-4" /></button>
      <button type="button" className={cn(BTN, matchCase && "bg-muted text-foreground")} aria-pressed={matchCase}
        onClick={() => { setMatchCase((m) => !m); setCurrent(0); }} title="Rozróżniaj wielkość liter">Aa</button>
      <input value={replacement} onChange={(e) => setReplacement(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); replaceCurrent(); } }}
        placeholder="Zamień na" aria-label="Zamień na" className={FIELD} />
      <button type="button" className={BTN} onClick={replaceCurrent} disabled={index < 0}>Zamień</button>
      <button type="button" className={BTN} onClick={replaceEvery} disabled={matches.length === 0}>Zamień wszystkie</button>
      <button type="button" className={BTN} onClick={() => { onClose(); textareaRef.current?.focus(); }} aria-label="Zamknij pasek"><X className="w-4 h-4" /></button>
    </div>
  );
}
