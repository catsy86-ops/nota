import { cn } from "@/lib/utils";

/**
 * Linijka „czego brakuje” pod formularzem (nowy plan 2.4). Nieaktywny przycisk nie mówi sam, dlaczego nie działa,
 * więc wskazuje tę linijkę przez `aria-describedby={id}`. Bez braku element zostaje (pusty, `sr-only`), żeby
 * `aria-describedby` zawsze miało cel, a czytnik usłyszał zmianę (`aria-live`).
 */
export function MissingHint({ id, missing, className }: { id: string; missing: string | null; className?: string }) {
  return (
    <p id={id} aria-live="polite" className={cn("text-xs text-muted-foreground", !missing && "sr-only", className)}>
      {missing ?? ""}
    </p>
  );
}
