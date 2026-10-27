import { LoaderCircle } from "lucide-react";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { cn } from "@/lib/utils";

/**
 * Kręcące się kółko, które pojawia się dopiero po 300 ms oczekiwania (plan UI 3.3).
 * Szybka operacja nie pokazuje go wcale, a miejsce na ikonę jest zarezerwowane od razu
 * (`invisible`), więc przycisk ani pasek statusu nie przeskakują.
 */
export function DelayedSpinner({ active, className }: { active: boolean; className?: string }) {
  const on = useDelayedFlag(active, 300);
  return <LoaderCircle aria-hidden className={cn("animate-spin", className, !on && "invisible")} />;
}
