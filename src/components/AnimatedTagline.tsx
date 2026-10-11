import { cn } from "@/lib/utils";

interface AnimatedTaglineProps {
  text: string;
  className?: string;
}

/**
 * Hasło z animacją liter: jednorazowe wynurzenie (przesunięcie + rozmycie → ostrość,
 * litera po literze), a potem co kilka sekund fala koloru przebiegająca po tekście.
 * Style `.tagline-*` w `index.css`; przy `prefers-reduced-motion` tekst stoi spokojnie.
 */
export function AnimatedTagline({ text, className }: AnimatedTaglineProps) {
  let index = 0;
  return (
    <p className={cn("tagline", className)} aria-label={text}>
      {text.split(" ").map((word, w) => (
        <span key={w} className="tagline-word" aria-hidden="true">
          {Array.from(word).map((ch, c) => (
            <span key={c} className="tagline-char" style={{ "--i": index++ } as React.CSSProperties}>
              {ch}
            </span>
          ))}
          {" "}
        </span>
      ))}
    </p>
  );
}
