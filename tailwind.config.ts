import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        display: ['Plus Jakarta Sans Variable', 'Plus Jakarta Sans', 'sans-serif'],
        logo: ['Unbounded Variable', 'Plus Jakarta Sans Variable', 'sans-serif'],
        // Jeden krój interfejsu — Inter był drugim, prawie takim samym.
        body: ['Plus Jakarta Sans Variable', 'Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono Variable', 'ui-monospace', 'monospace'],
      },
      colors: {
        note: {
          DEFAULT: "hsl(var(--note-default))",
          coral: "hsl(var(--note-coral))",
          peach: "hsl(var(--note-peach))",
          sand: "hsl(var(--note-sand))",
          mint: "hsl(var(--note-mint))",
          sage: "hsl(var(--note-sage))",
          sky: "hsl(var(--note-sky))",
          lavender: "hsl(var(--note-lavender))",
          rose: "hsl(var(--note-rose))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          // Tekst na papierze: ten sam kolor motywu, przyciemniony do ~5,5:1 (w ciemnym motywie bez zmian).
          ink: "color-mix(in srgb, hsl(var(--primary)) var(--ink-mix, 62%), black)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          // Tekst i ikony na tle — tło przycisku zostaje, bo biały tekst na nim ma 4.8:1.
          ink: "hsl(var(--destructive-ink))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          // Tekst i ikony na jasnym tle — jak `primary-ink` (sam kolor ma za mały kontrast).
          ink: "color-mix(in srgb, hsl(var(--success)) var(--ink-mix, 62%), black)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          // Tekst i ikony na jasnym tle — jak `primary-ink` (sam kolor ma za mały kontrast).
          ink: "color-mix(in srgb, hsl(var(--warning)) var(--ink-mix, 62%), black)",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      fontSize: {
        // Najmniejszy stopień w skali — tylko badge i liczniki. Niżej nie schodzimy.
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        "elevation-1": "var(--elevation-1)",
        "elevation-2": "var(--elevation-2)",
        "elevation-3": "var(--elevation-3)",
        "elevation-up": "var(--elevation-up)",
        "glow-primary": "var(--glow-primary)",
        // Domyślne stopnie Tailwinda (też w komponentach shadcn) mapujemy na
        // trzy poziomy uniesienia — jeden system cieni w całej aplikacji.
        sm: "var(--elevation-1)",
        md: "var(--elevation-2)",
        lg: "var(--elevation-3)",
        xl: "var(--elevation-3)",
        "2xl": "var(--elevation-3)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Trzy promienie systemu (index.css `--r-*`): przyciski i ikony, pola, karty i kafle.
        control: "var(--r-control)",
        field: "var(--r-field)",
        card: "var(--r-card)",
      },
      // Tokeny ruchu z index.css — `duration-fast`, `ease-out-soft` itd.
      transitionDuration: {
        press: "var(--dur-press)",
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
        slow: "var(--dur-slow)",
      },
      transitionTimingFunction: {
        "out-soft": "var(--ease-out)",
        "in-soft": "var(--ease-in)",
        std: "var(--ease-std)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "slide-in-left": {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        // Kreska zaznaczenia „długopisem”: odsłania się od lewej (clip-path).
        "check-draw": {
          from: { clipPath: "inset(0 100% 0 0)" },
          to: { clipPath: "inset(0 0 0 0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        // Udawana karetka w kratce `InputOTP`.
        "caret-blink": {
          "0%, 70%, 100%": { opacity: "1" },
          "20%, 50%": { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in var(--dur-base) var(--ease-out)",
        "scale-in": "scale-in var(--dur-base) var(--ease-out)",
        "slide-in-left": "slide-in-left 0.3s ease-out",
        "check-draw": "check-draw var(--dur-base) var(--ease-out)",
        shimmer: "shimmer 2s infinite linear",
        float: "float 3s ease-in-out infinite",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
      },
    },
  },
  plugins: [
    // `coarse:` — palec zamiast kursora (cele dotykowe min. 44 px).
    (({ addVariant }: { addVariant: (name: string, def: string) => void }) => addVariant("coarse", "@media (pointer: coarse)")),
    // `desk:` — układ z paskiem bocznym. Jak `md:`, ale telefon w poziomie (niski ekran dotykowy)
    // zostaje przy dolnej nawigacji i wysuwanym panelu (src/hooks/use-mobile.tsx — to samo zapytanie).
    (({ addVariant }: { addVariant: (name: string, def: string) => void }) => addVariant("desk", "@media (min-width: 768px) and (min-height: 501px), (min-width: 768px) and (pointer: fine)")),
    // `phone:` — dokładne przeciwieństwo `desk:`: wąski ekran albo niski ekran dotykowy (telefon w poziomie).
    // Formularze są tu arkuszem od dołu (ui/responsive-dialog.tsx).
    (({ addVariant }: { addVariant: (name: string, def: string) => void }) => addVariant("phone", "@media (max-width: 767px), (max-height: 500px) and (pointer: coarse)")),
    // `short:` — telefon w poziomie (niski ekran dotykowy): mało wysokości, więc chowamy podpowiedzi
    // i trzymamy paletę w jednym rzędzie, żeby siatka miesiąca była bliżej góry.
    (({ addVariant }: { addVariant: (name: string, def: string) => void }) => addVariant("short", "@media (orientation: landscape) and (max-height: 500px) and (pointer: coarse)")),
  ],
} satisfies Config;
