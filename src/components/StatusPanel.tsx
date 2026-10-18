import type { ReactNode } from "react";
import { m as motion } from "framer-motion";
import { SearchX, TriangleAlert, WifiOff, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { tween } from "@/lib/motion";

/**
 * Rodzaj stanu. `empty` — jeszcze nic tu nie ma (zaproszenie do działania);
 * `no-results` — są dane, ale filtr/szukanie nic nie zwróciło; `error` — awaria;
 * `offline` — czegoś nie da się zrobić bez internetu.
 */
export type StatusTone = "empty" | "no-results" | "error" | "offline";

const TONE_ICON: Record<StatusTone, LucideIcon | null> = {
  empty: null,
  "no-results": SearchX,
  error: TriangleAlert,
  offline: WifiOff,
};

/** Kolor kreski rysunku: akcent dla pustki, przygaszony dla „nic nie pasuje”, ostrzegawczy dla błędu. */
const TONE_INK: Record<StatusTone, string> = {
  empty: "text-accent",
  "no-results": "text-muted-foreground",
  error: "text-destructive",
  offline: "text-primary-ink",
};

export interface StatusPanelProps {
  tone?: StatusTone;
  /** Rysunek kreską; domyślnie ikona rodzaju stanu. `null` — bez rysunku. */
  icon?: LucideIcon | null;
  /** Własna ilustracja zamiast ikony (np. napis „Notatnik” w pustych Notatkach). */
  art?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Przyciski albo chipy pod opisem. */
  actions?: ReactNode;
  /**
   * `page` — cały widok jest pusty: duży rysunek, nagłówek, wejście z opóźnieniem.
   * `inline` — fragment widoku (lista, kolumna): przerywana ramka jak pole w zeszycie.
   */
  size?: "page" | "inline";
  /** Poziom nagłówka w `page` (domyślnie h2). */
  headingLevel?: 2 | 3;
  className?: string;
  children?: ReactNode;
}

/**
 * Jeden wzór dla pustki, błędu, braku sieci i „nic nie znaleziono” we wszystkich widokach.
 * Błąd ogłasza się czytnikowi ekranu (`role="alert"`), brak sieci jako `status`.
 */
export function StatusPanel({
  tone = "empty",
  icon,
  art,
  title,
  description,
  actions,
  size = "page",
  headingLevel = 2,
  className,
  children,
}: StatusPanelProps) {
  const Icon = icon === undefined ? TONE_ICON[tone] : icon;
  const role = tone === "error" ? "alert" : tone === "offline" ? "status" : undefined;

  if (size === "inline") {
    return (
      <div
        role={role}
        data-status={tone}
        className={cn(
          "rounded-xl border border-dashed px-4 py-6 text-center text-sm",
          tone === "error" ? "border-destructive/50 bg-destructive/5" : "border-border",
          className,
        )}
      >
        {art ?? (Icon && <Icon aria-hidden strokeWidth={1.5} className={cn("mx-auto mb-2 h-6 w-6 -rotate-6", TONE_INK[tone])} />)}
        <p className={cn(description ? "font-medium text-foreground" : "text-muted-foreground")}>{title}</p>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
        {actions && <div className="mt-3 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
        {children}
      </div>
    );
  }

  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <motion.div
      role={role}
      data-status={tone}
      initial={{ opacity: 0, y: tone === "empty" ? 30 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: tone === "empty" ? 0.3 : 0 }}
      // Wyjście, gdy w widoku pojawią się notatki (`AnimatePresence` w `Index`): gaśnie zamiast zniknąć skokiem.
      exit={{ opacity: 0, transition: tween.exit }}
      className={cn("text-center", tone === "empty" ? "py-20 sm:py-24" : "py-14 sm:py-16", className)}
    >
      {art ?? (Icon && (
        <Icon
          aria-hidden
          strokeWidth={1.1}
          className={cn("mx-auto -rotate-6", tone === "empty" ? "mb-5 h-20 w-20" : "mb-4 h-14 w-14", TONE_INK[tone])}
        />
      ))}
      <Heading className={cn("font-display font-bold text-foreground", tone === "empty" ? "mb-2 text-2xl" : "mb-1 text-lg")}>
        {title}
      </Heading>
      {description && <p className="mx-auto max-w-sm text-muted-foreground">{description}</p>}
      {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
      {children}
    </motion.div>
  );
}
