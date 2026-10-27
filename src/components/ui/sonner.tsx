import { useTheme } from "@/hooks/useTheme";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { dark } = useTheme();

  return (
    <Sonner
      theme={dark ? "dark" : "light"}
      className="toaster group"
      // Kolory przez zmienne Sonnera (jak w shadcn): jego style są poza warstwami CSS,
      // więc w Tailwind 4 wygrywają z każdą klasą bez `!`.
      style={{
        "--normal-bg": "var(--background)",
        "--normal-text": "var(--foreground)",
        "--normal-border": "var(--border)",
      } as React.CSSProperties}
      // Przycisk „×” na każdym toście: błąd z długim opisem (9 s) da się zamknąć dotykiem od razu,
      // bez czekania na licznik albo przeciągania.
      closeButton
      toastOptions={{
        classNames: {
          toast: "group toast shadow-elevation-3! rounded-field!",
          description: "text-muted-foreground!",
          // `!`: domyślne style Sonnera (czarny przycisk) są poza warstwami CSS.
          actionButton: "bg-primary! text-primary-foreground! font-medium! rounded-control! pressable",
          cancelButton: "bg-muted! text-muted-foreground!",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
