import * as React from "react";
import { cn } from "@/lib/utils";

/** Klasa karty dla miejsc, które nie mogą być `<Card>` (np. `motion.div`, `<li>`). */
export const cardClass = "rounded-card border border-border bg-card";

/**
 * W3.1: odmiany karty. Promień i obrys tylko stąd — ręczne `rounded-card border` poza `ui/` znikają działami (W3.2).
 * - `plain` — obrys, bez cienia (domyślna);
 * - `raised` — obrys i elewacja 1 (karta nad tłem, np. podsumowanie);
 * - `inset` — grupa w karcie: tło wyciszone, bez obrysu (W3.3: karta w karcie tylko tak);
 * - `interactive` — cała karta klikalna: hover, wciśnięcie, pierścień fokusu; wybrana (`aria-selected|pressed|current`)
 *   obrys w akcencie; nieaktywna (`aria-disabled`) tekst `--faint` bez reakcji (W4.4);
 * - `status` — lewa krawędź w kolorze stanu (`tone`).
 */
const VARIANT = {
  plain: cardClass,
  raised: `${cardClass} shadow-elevation-1`,
  inset: "rounded-field bg-muted/50",
  interactive: `${cardClass} pressable cursor-pointer transition-colors hover:border-foreground/25 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring aria-selected:border-primary aria-pressed:border-primary aria-[current]:border-primary aria-disabled:pointer-events-none aria-disabled:text-faint`,
  status: `${cardClass} border-l-4`,
} as const;

const TONE = {
  info: "border-l-primary",
  success: "border-l-success",
  warning: "border-l-warning",
  danger: "border-l-destructive",
} as const;

export type CardVariant = keyof typeof VARIANT;
export type CardTone = keyof typeof TONE;

/** Klasa odmiany — dla `motion.div`, `<li>` i przycisków, które nie mogą być `<Card>`. */
export function cardVariant(variant: CardVariant = "plain", tone: CardTone = "info"): string {
  return variant === "status" ? `${VARIANT.status} ${TONE[tone]}` : VARIANT[variant];
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Tylko dla `variant="status"`. */
  tone?: CardTone;
}

/**
 * Goła karta (plan UI 2026-11-06, 1.3): promień, obrys i tło z tokenów, bez nagłówka.
 * Karta z tytułem to `SectionCard`, która stoi na tej samej klasie.
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, variant = "plain", tone = "info", ...props }, ref) => (
  <div ref={ref} className={cn(cardVariant(variant, tone), className)} {...props} />
));
Card.displayName = "Card";
