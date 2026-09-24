import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BeerMugLogoProps {
  className?: string;
}

/**
 * Animowany kufel piwa — pęcherzyki wznoszące się w płynie i lekko
 * kołysząca się piana. Czysty SVG + framer-motion, bez zasobów graficznych.
 */
export function BeerMugLogo({ className }: BeerMugLogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("w-8 h-8 drop-shadow-sm", className)}
      aria-hidden="true"
    >
      <defs>
        <clipPath id="beer-liquid-clip">
          <path d="M4.5 6.5h12v11.5a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2Z" />
        </clipPath>
      </defs>

      {/* uchwyt */}
      <path
        d="M16.5 8.5h1.8a2.7 2.7 0 0 1 2.7 2.7v3.6a2.7 2.7 0 0 1-2.7 2.7h-1.8"
        fill="none"
        stroke="#b8860b"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* kufel - kontur */}
      <path
        d="M4.5 6.5h12v11.5a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2Z"
        fill="#fde68a"
        stroke="#b8860b"
        strokeWidth="1"
      />

      {/* płyn + pęcherzyki, przycięte do kufla */}
      <g clipPath="url(#beer-liquid-clip)">
        <rect x="4.5" y="9.5" width="12" height="8.5" fill="#f59e0b" />
        {[
          { cx: 7.5, r: 0.5, delay: 0 },
          { cx: 10.5, r: 0.4, delay: 0.6 },
          { cx: 13.5, r: 0.55, delay: 1.1 },
          { cx: 9, r: 0.35, delay: 1.7 },
        ].map((b, i) => (
          <motion.circle
            key={i}
            cx={b.cx}
            r={b.r}
            fill="#fff7ed"
            fillOpacity={0.8}
            initial={{ cy: 18, opacity: 0 }}
            animate={{ cy: [18, 9.5], opacity: [0, 0.9, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: b.delay, ease: "easeIn" }}
          />
        ))}
      </g>

      {/* piana */}
      <motion.path
        d="M4 7.2c0-1.5 1.3-2.7 2.9-2.7.6 0 1.1.2 1.6.5.4-.9 1.3-1.5 2.4-1.5s2 .6 2.4 1.5c.5-.3 1-.5 1.6-.5 1.6 0 2.9 1.2 2.9 2.7 0 .2 0 .4-.1.6H4.1c0-.2-.1-.4-.1-.6Z"
        fill="#fffbeb"
        stroke="#e7d8a8"
        strokeWidth="0.4"
        animate={{ y: [0, -0.3, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
    </svg>
  );
}
