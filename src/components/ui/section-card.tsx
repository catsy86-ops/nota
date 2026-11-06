import { useId, type HTMLAttributes, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardClass } from "@/components/ui/card";

export interface SectionCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  icon?: LucideIcon;
  title: ReactNode;
  /** Licznik albo krótka informacja obok tytułu (mono, cyfry tabelaryczne). */
  meta?: ReactNode;
  /** Jedna linijka pod tytułem — także cała treść pustej karty. */
  description?: ReactNode;
  /** Akcja po prawej w nagłówku (na wąskim ekranie schodzi pod tytuł). */
  action?: ReactNode;
  /** Stopka pod kreską, np. link „Wszystkie…”. */
  footer?: ReactNode;
  /** Poziom nagłówka: w widoku h2 (pod h1 główki), w oknie albo karcie w karcie h3, w grupie ustawień h4. */
  level?: 2 | 3 | 4;
  bodyClassName?: string;
}

/**
 * Jedna karta (nowy plan 2026-11-05, 2.1; zasada 3): nagłówek z ikoną, tytułem zdaniem, meta i akcją po prawej,
 * treść i opcjonalna stopka. Pusta karta to sam nagłówek z linijką `description` — bez pustej treści na pół ekranu.
 * Sekcja ma nazwę z tytułu (`aria-labelledby`), chyba że widok poda własne `aria-label`.
 */
export function SectionCard({ icon: Icon, title, meta, description, action, footer, level = 2, className, bodyClassName, children, ...rest }: SectionCardProps) {
  const headingId = useId();
  const Heading = level === 2 ? "h2" : level === 3 ? "h3" : "h4";
  const hasBody = children !== undefined && children !== null && children !== false;
  return (
    <section aria-labelledby={rest["aria-label"] ? undefined : headingId} className={cn(cardClass, "p-4 sm:p-5", className)} {...rest}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <Heading id={headingId} className="section-label gap-2">
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            {title}
            {meta !== undefined && meta !== null && meta !== false && (
              <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{meta}</span>
            )}
          </Heading>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </div>
      {hasBody && <div className={cn("mt-3", bodyClassName)}>{children}</div>}
      {footer && <div className="mt-3 border-t border-border/60 pt-3 text-sm">{footer}</div>}
    </section>
  );
}
