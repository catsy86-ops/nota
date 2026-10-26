import { useMemo } from "react";
import { Quote } from "lucide-react";
import { getDailyQuote } from "@/lib/dailyQuote";
import { useEffectsSettings } from "@/lib/effectsSettings";

export function DailyQuote() {
  const settings = useEffectsSettings();
  const quote = useMemo(() => getDailyQuote(), []);
  if (!settings.dailyQuote) return null;

  return (
    // Cichy dopisek pod siatką, nie baner nad polem dodawania — główne
    // zadanie ekranu to zapisanie notatki.
    // `data-visual-mask`: zrzuty ekranu (e2e/visual.spec.ts) ukrywają cytat, bo zmienia się co dzień.
    <figure
      data-visual-mask=""
      className="fade-quiet max-w-xl mx-auto pt-6 flex items-start justify-center gap-2 text-center"
    >
      <Quote className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0">
        <blockquote className="text-sm italic text-muted-foreground leading-snug">„{quote.text}”</blockquote>
        <figcaption className="text-xs text-muted-foreground mt-1">— {quote.author}</figcaption>
      </div>
    </figure>
  );
}
