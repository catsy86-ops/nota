import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Szybka akcja budowy: link (telefon, SMS, Mapy) wyglądający jak przycisk — karta budowy i „Przed wejściem”. */
export function QuickLink({ href, icon: Icon, children, label, className }: { href: string; icon: LucideIcon; children: React.ReactNode; label?: string; className?: string }) {
  const external = href.startsWith("https:");
  return (
    <Button asChild variant="outline" size="sm" className={cn("pressable h-10 min-w-0 justify-start gap-1.5 coarse:h-11", className)}>
      <a href={href} aria-label={label} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        <Icon className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden />
        <span className="truncate">{children}</span>
      </a>
    </Button>
  );
}
