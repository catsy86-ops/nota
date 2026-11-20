import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

// Wciśnięcie = dociśnięcie: reguła `.pressable` z index.css (1 px w dół, ciemniej) + wewnętrzny cień.
// Nieaktywny (nowy plan 2.4): bez `opacity-50` — blady bursztyn wyglądał na zepsuty i miał za mały kontrast.
// Wypełnione warianty przechodzą na neutralne tło z tekstem `--faint` (W4.4: jeden wzór nieaktywnego), obrysowe tylko szarzeją.
// Czego brakuje, mówi linijka pod formularzem (`aria-describedby`), nie sam przycisk.
// Promień siedzi w wariancie, nie w bazie: `cn` (tailwind-merge) nie zna `rounded-control`, więc nie zdjąłby go
// pod `rounded-full` pigułki (plan UI 2026-11-06, 1.2).
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background pressable active:shadow-[inset_0_1px_2px_color-mix(in srgb, var(--foreground) 12%, transparent)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:[stroke-width:var(--icon-stroke)]",
  {
    variants: {
      variant: {
        default: "rounded-control bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-faint",
        destructive: "rounded-control bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:bg-muted disabled:text-faint",
        outline: "rounded-control border border-input bg-background hover:bg-muted hover:text-foreground disabled:text-faint",
        secondary: "rounded-control bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:bg-muted disabled:text-faint",
        ghost: "rounded-control hover:bg-muted hover:text-foreground disabled:text-faint",
        link: "rounded-control text-primary-ink underline-offset-4 hover:underline active:translate-none! active:shadow-none active:filter-none! disabled:text-faint disabled:no-underline",
        /** Pasek narzędzi działu (Cofnij/Ponów w Grafiku): obrys na karcie, żeby stał osobno od siatki. */
        toolbar: "rounded-control border border-border/60 bg-card hover:bg-muted disabled:bg-muted/40 disabled:text-faint",
        /** Pigułka podpowiedzi (budowa, „Tu jestem”): akcentowy obrys, cała szerokość tekstu. */
        pill: "max-w-full gap-1 rounded-full border border-primary/40 text-primary-ink hover:bg-primary/10 disabled:border-border disabled:text-faint",
        /** W4.5: pigułka neutralna (filtr, szybki wybór); jako przełącznik z `aria-pressed` — wybrana w akcencie. */
        chip: "rounded-full border border-border font-normal hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary/10 disabled:text-faint",
        /** Pigułka-podpowiedź (wstaw tekst, gotowa wartość): wypełniona, bez obrysu. */
        "chip-soft": "rounded-full bg-muted font-normal hover:bg-primary/10 disabled:text-faint",
        /** Pigułka „dodaj” (nowa pozycja, własna wartość): obrys przerywany, tekst wyciszony. */
        "chip-add": "rounded-full border border-dashed border-border font-normal text-muted-foreground hover:border-primary hover:text-foreground disabled:text-faint",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "tap-target size-9 coarse:h-11 coarse:w-11",
        "icon-sm": "tap-target size-8 coarse:h-11 coarse:w-11",
        /** Duży przycisk z ikoną na pasku działu — zawsze 44 px, ikona 20 px. */
        "icon-lg": "size-11 [&_svg]:size-5",
        pill: "h-9 px-3 coarse:min-h-11",
        /** Pigułka w linii tekstu (podpowiedzi, filtry): niska, na dotyku 44 px. */
        chip: "h-auto whitespace-normal gap-1 px-2.5 py-1 text-xs coarse:min-h-11 coarse:px-3.5 coarse:text-sm [&_svg]:size-3.5",
        /** Pigułka w rzędzie akcji (wybór, „dodaj” w formularzu). */
        "chip-md": "h-auto whitespace-normal gap-1.5 px-3 py-1.5 coarse:min-h-11",
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
