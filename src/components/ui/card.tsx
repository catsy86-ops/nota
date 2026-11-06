import * as React from "react";
import { cn } from "@/lib/utils";

/** Klasa karty dla miejsc, które nie mogą być `<Card>` (np. `motion.div`, `<li>`). */
export const cardClass = "rounded-card border border-border bg-card";

/**
 * Goła karta (plan UI 2026-11-06, 1.3): promień, obrys i tło z tokenów, bez nagłówka.
 * Karta z tytułem to `SectionCard`, która stoi na tej samej klasie.
 */
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(cardClass, className)} {...props} />
));
Card.displayName = "Card";
