import { useMemo } from "react";
import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { getDailyQuote } from "@/lib/dailyQuote";
import { useEffectsSettings } from "@/lib/effectsSettings";

export function DailyQuote() {
  const settings = useEffectsSettings();
  const quote = useMemo(() => getDailyQuote(), []);
  if (!settings.dailyQuote) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-border/50 bg-gradient-to-r from-primary/5 via-accent/5 to-secondary/5 px-4 py-3 flex items-start gap-3"
    >
      <Quote className="w-4 h-4 text-primary shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm italic text-foreground/90 leading-snug">"{quote.text}"</p>
        <p className="text-[11px] text-muted-foreground mt-1">— {quote.author}</p>
      </div>
    </motion.div>
  );
}
