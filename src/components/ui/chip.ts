/**
 * Dwa tony małych znaczników (chipów) w całej aplikacji (§audyt 6): neutralny do linków i etykiet,
 * akcentowy do etapu i stanów. Wspólne klasy zamiast kilku przepisów z różnym tłem.
 */
export const CHIP_NEUTRAL = "rounded-full bg-muted px-2 py-0.5 hover:bg-primary/10 hover:text-primary-ink";
export const CHIP_ACCENT = "rounded-full bg-primary/10 px-2 py-0.5 text-primary-ink";

/**
 * Chip filtra z licznikiem (nowy plan 2.2, zasada 4): włączony — akcent, włączony z zerem — przygaszony
 * (nic by nie pokazał, więc nie świeci bursztynem), wyłączony — przekreślony.
 */
export function filterChipClass(on: boolean, count: number): string {
  const base = "rounded-control border px-2.5 py-1 text-xs font-medium coarse:min-h-11 outline-hidden focus-visible:ring-2 focus-visible:ring-ring";
  if (!on) return `${base} border-border/60 text-muted-foreground line-through hover:text-foreground`;
  if (count === 0) return `${base} border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground`;
  return `${base} border-primary/40 bg-primary/10 text-primary-ink`;
}
