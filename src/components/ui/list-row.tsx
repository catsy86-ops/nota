import * as React from "react";
import { cn } from "@/lib/utils";

export interface ListRowProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** Ikona po lewej (`aria-hidden` po stronie wywołującego). */
  icon?: React.ReactNode;
  title: React.ReactNode;
  /** Linijka pod tytułem: data, stan, opis. */
  description?: React.ReactNode;
  /** Wartość po prawej (kwota, godziny, licznik) — mono, cyfry tabelaryczne. */
  value?: React.ReactNode;
  /** Przycisk albo menu na końcu wiersza; poza obszarem tytułu, więc nie zagnieżdża się w `<button>`. */
  action?: React.ReactNode;
  /** `li` w liście `<ul>`, `div` gdzie indziej. */
  as?: "li" | "div";
}

/**
 * W3.4: jeden wiersz listy — ikona, tytuł, opis, wartość po prawej, akcja.
 * Wiersz nie rysuje separatora: rodzic daje albo odstęp (`space-y-*`), albo jedną linię (`divide-y divide-border`) — nie oba.
 * Grubości z W2.3: tytuł 500, opis 400 wyciszony (`ui-meta`), wartość 500.
 */
export const ListRow = React.forwardRef<HTMLElement, ListRowProps>(
  ({ icon, title, description, value, action, as: Tag = "div", className, ...rest }, ref) => (
    <Tag ref={ref as never} className={cn("flex min-h-11 items-center gap-3 py-2", className)} {...rest}>
      {icon && <span className="grid size-5 shrink-0 place-items-center text-muted-foreground">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="ui-label block truncate text-foreground">{title}</span>
        {description && <span className="ui-meta block truncate">{description}</span>}
      </span>
      {value !== undefined && <span className="ui-label shrink-0 font-mono tabular-nums text-foreground">{value}</span>}
      {action && <span className="shrink-0">{action}</span>}
    </Tag>
  ),
);
ListRow.displayName = "ListRow";
