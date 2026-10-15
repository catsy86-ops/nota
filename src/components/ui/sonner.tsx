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
        "--normal-bg": "hsl(var(--background))",
        "--normal-text": "hsl(var(--foreground))",
        "--normal-border": "hsl(var(--border))",
      } as React.CSSProperties}
      toastOptions={{
        classNames: {
          toast: "group toast shadow-lg! rounded-lg!",
          description: "text-muted-foreground!",
          // `!`: domyślne style Sonnera (czarny przycisk) są poza warstwami CSS.
          actionButton: "bg-primary! text-primary-foreground! font-medium! rounded-md! pressable",
          cancelButton: "bg-muted! text-muted-foreground!",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
