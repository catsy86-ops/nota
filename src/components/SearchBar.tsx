import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Bookmark, Search, X } from "lucide-react";
import { m as motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { tween, spring } from "@/lib/motion";
import { useMotionPref } from "@/hooks/useMotionPref";
import { useNotesContext } from "@/hooks/NotesProvider";
import { useSavedFilters, sameQuery, MAX_FILTER_NAME } from "@/lib/savedFilters";
import { suggestOperators, applySuggestion } from "@/lib/searchSuggest";

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

/** Stała etykieta pola: podpowiedzi operatorów są w pustym wyniku wyszukiwania, a nie w polu, które się zmienia. */
const PLACEHOLDER = "Szukaj notatek...";

/** Pauza w pisaniu, po której zapytanie idzie do widoku (filtrowanie 300 kafli na każdy znak blokowało klawiaturę). */
const SEARCH_DEBOUNCE_MS = 150;

export function SearchBar({ value: externalValue, onChange, className }: SearchBarProps) {
  // Własny stan pola: znak pojawia się od razu, a widok przelicza się dopiero po krótkiej pauzie.
  const [value, setValue] = useState(externalValue);
  const sent = useRef(externalValue);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    // Zmiana z zewnątrz (filtr z paska, operator z palety, „wstecz”) — nie nasze opóźnione wysłanie.
    if (externalValue !== sent.current) {
      sent.current = externalValue;
      window.clearTimeout(timer.current);
      setValue(externalValue);
    }
  }, [externalValue]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const commit = (v: string) => {
    window.clearTimeout(timer.current);
    setValue(v);
    sent.current = v;
    onChange(v);
  };
  const typeValue = (v: string) => {
    setValue(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { sent.current = v; onChange(v); }, SEARCH_DEBOUNCE_MS);
  };
  const [focused, setFocused] = useState(false);
  const { reduced } = useMotionPref();
  const { allLabels, folders } = useNotesContext();
  const { filters, add } = useSavedFilters();
  const listId = useId();

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  // Indeks podświetlonej podpowiedzi (-1 = brak: Enter zostaje zwykłym Enterem).
  const [active, setActive] = useState(-1);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => { if (saving) nameRef.current?.focus(); }, [saving]);
  useEffect(() => { setActive(-1); setDismissed(false); }, [value]);

  const folderNames = useMemo(() => [...new Set(folders.map((f) => f.name))], [folders]);
  const suggestions = useMemo(
    () => suggestOperators(value, { labels: allLabels, folders: folderNames }),
    [value, allLabels, folderNames],
  );
  const showSuggestions = focused && !dismissed && !saving && suggestions.items.length > 0;
  const canSave = value.trim().length > 0 && !filters.some((f) => sameQuery(f.query, value));

  function pick(i: number) {
    const s = suggestions.items[i];
    if (!s) return;
    commit(applySuggestion(value, suggestions.from, s));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions) return;
    const n = suggestions.items.length;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % n); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i <= 0 ? n - 1 : i - 1)); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(active); }
    else if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); pick(active >= 0 ? active : 0); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setDismissed(true); }
  }

  function submitSave(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    add(n, value);
    toast.success(`Zapisano filtr „${n}”`);
    setSaving(false);
    setName("");
  }

  return (
    // Bez `layout`: animacja układu tego pola mierzyła przy każdym znaku wszystkie kafle (projekcja framer-motion).
    <motion.div
      className={cn("relative w-full max-w-md", className)}
      animate={{ scale: focused && !reduced ? 1.01 : 1 }}
      transition={spring.snap}
    >
      <Search
        className={cn(
          "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors",
          focused ? "text-primary-ink" : "text-muted-foreground"
        )}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => typeValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        placeholder={PLACEHOLDER}
        aria-label="Szukaj w notatkach"
        enterKeyHint="search"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-controls={showSuggestions ? listId : undefined}
        aria-activedescendant={showSuggestions && active >= 0 ? `${listId}-${active}` : undefined}
        className={cn(
          "w-full pl-10 py-2.5 rounded-xl bg-muted/60 border text-base md:text-sm text-foreground placeholder:text-muted-foreground outline-hidden transition-[border-color,box-shadow,background-color] duration-fast ease-std",
          value ? (canSave ? "pr-18" : "pr-9") : "pr-9",
          focused ? "border-primary/50 ring-2 ring-primary/20 bg-background" : "border-border"
        )}
      />
      <AnimatePresence>
        {value && canSave && (
          <motion.button
            type="button"
            aria-label="Zapisz wyszukiwanie jako filtr"
            aria-expanded={saving}
            title="Zapisz jako filtr"
            initial={{ opacity: 0, scale: reduced ? 1 : 0.8 }}
            animate={{ opacity: 1, scale: 1, transition: tween.enter }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.8, transition: tween.exit }}
            onClick={() => setSaving((v) => !v)}
            className="pressable absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary-ink"
          >
            <Bookmark className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {value && (
          <motion.button
            type="button"
            aria-label="Wyczyść wyszukiwanie"
            initial={{ opacity: 0, scale: reduced ? 1 : 0.8 }}
            animate={{ opacity: 1, scale: 1, transition: tween.enter }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.8, transition: tween.exit }}
            onClick={() => { setSaving(false); commit(""); }}
            className="pressable absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {showSuggestions && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Podpowiedzi operatorów"
          className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg"
        >
          {suggestions.items.map((s, i) => (
            <li
              key={s.insert}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, nie click: pole nie traci fokusu przed wstawieniem.
              onMouseDown={(e) => { e.preventDefault(); pick(i); }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "cursor-pointer truncate rounded-lg px-3 py-1.5 text-sm font-mono",
                i === active ? "bg-primary/10 text-primary-ink" : "text-foreground",
              )}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}

      {saving && (
        <form
          onSubmit={submitSave}
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setSaving(false); } }}
          className="absolute right-0 top-full z-30 mt-1.5 w-72 max-w-[90vw] space-y-2 rounded-xl border border-border bg-popover p-3 shadow-lg"
        >
          <label className="block text-2xs font-semibold uppercase tracking-wider text-muted-foreground" htmlFor={`${listId}-name`}>
            Nazwa filtra
          </label>
          <input
            id={`${listId}-name`}
            ref={nameRef}
            value={name}
            maxLength={MAX_FILTER_NAME}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Do zrobienia"
            className="w-full rounded-lg border border-border bg-muted/60 px-2.5 py-1.5 text-sm text-foreground outline-hidden focus:ring-2 focus:ring-ring"
          />
          <p className="truncate font-mono text-2xs text-muted-foreground">{value.trim()}</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setSaving(false)} className="pressable rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
              Anuluj
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="pressable rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Zapisz filtr
            </button>
          </div>
        </form>
      )}
    </motion.div>
  );
}
