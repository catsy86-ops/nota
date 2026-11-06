import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

// Wciśnięcie = dociśnięcie: reguła `.pressable` z index.css (1 px w dół, ciemniej) + wewnętrzny cień.
// Nieaktywny (nowy plan 2.4): bez `opacity-50` — blady bursztyn wyglądał na zepsuty i miał za mały kontrast.
// Wypełnione warianty przechodzą na neutralne tło z tekstem `muted-foreground`, obrysowe tylko szarzeją.
// Czego brakuje, mówi linijka pod formularzem (`aria-describedby`), nie sam przycisk.
// Promień siedzi w wariancie, nie w bazie: `cn` (tailwind-merge) nie zna `rounded-control`, więc nie zdjąłby go
// pod `rounded-full` pigułki (plan UI 2026-11-06, 1.2).
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background pressable active:shadow-[inset_0_1px_2px_color-mix(in srgb, var(--foreground) 12%, transparent)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:[stroke-width:1.75]",
  {
    variants: {
      variant: {
        default: "rounded-control bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground",
        destructive: "rounded-control bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:bg-muted disabled:text-muted-foreground",
        outline: "rounded-control border border-input bg-background hover:bg-muted hover:text-foreground disabled:text-muted-foreground",
        secondary: "rounded-control bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:bg-muted disabled:text-muted-foreground",
        ghost: "rounded-control hover:bg-muted hover:text-foreground disabled:text-muted-foreground",
        link: "rounded-control text-primary-ink underline-offset-4 hover:underline active:translate-none! active:shadow-none active:filter-none! disabled:text-muted-foreground disabled:no-underline",
        /** Pasek narzędzi działu (Cofnij/Ponów w Grafiku): obrys na karcie, żeby stał osobno od siatki. */
        toolbar: "rounded-control border border-border/60 bg-card hover:bg-muted disabled:bg-muted/40 disabled:text-muted-foreground",
        /** Pigułka podpowiedzi (budowa, „Tu jestem”): akcentowy obrys, cała szerokość tekstu. */
        pill: "max-w-full gap-1 rounded-full border border-primary/40 text-primary-ink hover:bg-primary/10 disabled:border-border disabled:text-muted-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "tap-target h-9 w-9 coarse:h-11 coarse:w-11",
        "icon-sm": "tap-target h-8 w-8 coarse:h-11 coarse:w-11",
        /** Duży przycisk z ikoną na pasku działu — zawsze 44 px, ikona 20 px. */
        "icon-lg": "h-11 w-11 [&_svg]:size-5",
        pill: "h-9 px-3 coarse:min-h-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Trwa zapis lub wczytywanie: kółko zamiast pierwszej ikony, przycisk nieaktywny i `aria-busy`.
   *  Etykieta zostaje, więc szerokość nie skacze. Z `asChild` nie działa (Slot ma jedno dziecko). */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    if (asChild) {
      return <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} {...{ disabled }}>{children}</Slot>;
    }
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
        {loading ? React.Children.toArray(children).filter((c, i) => !(i === 0 && React.isValidElement(c) && typeof c.type !== "string")) : children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
