import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

const HINTS = [
  "Szukaj notatek...",
  "Spróbuj: label:praca",
  "Spróbuj: color:coral",
  "Spróbuj: has:reminder",
  "Naciśnij / aby wyszukać",
];

export function SearchBar({ value, onChange, className }: SearchBarProps) {
  const [hintIdx, setHintIdx] = useState(0);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused || value) return;
    const id = setInterval(() => setHintIdx((i) => (i + 1) % HINTS.length), 3200);
    return () => clearInterval(id);
  }, [focused, value]);

  return (
    <motion.div
      layout
      className={cn("relative w-full max-w-md", className)}
      animate={{ scale: focused ? 1.015 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
    >
      <Search
        className={cn(
          "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors",
          focused ? "text-primary" : "text-muted-foreground"
        )}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={HINTS[hintIdx]}
        className={cn(
          "w-full pl-10 pr-9 py-2.5 rounded-xl bg-muted/60 border text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all",
          focused ? "border-primary/50 ring-2 ring-primary/20 bg-background" : "border-border"
        )}
      />
      <AnimatePresence>
        {value && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileTap={{ scale: 0.85, rotate: 90 }}
            onClick={() => onChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
