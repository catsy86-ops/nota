import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface NotkiLogoProps {
  size?: "sm" | "lg";
  className?: string;
}

const LETTERS = ["N", "O", "T", "K", "I"];

/**
 * Wordmark „NOTKI”: litery wjeżdżają kaskadą z rozmycia, jakby słowo było
 * właśnie zapisywane, po nich miga kursor. Wypełnienie gradientem marki,
 * co kilka sekund przez litery przechodzi błysk (CSS, patrz `.notki-*`
 * w index.css). Przy `prefers-reduced-motion` wszystko stoi.
 */
export function NotkiLogo({ size = "lg", className }: NotkiLogoProps) {
  const reduce = useReducedMotion();
  return (
    <span
      role="img"
      aria-label="NOTKI"
      className={cn("notki-logo font-logo font-extrabold", size === "lg" ? "text-[1.6rem]" : "text-lg", className)}
    >
      {LETTERS.map((letter, i) => (
        <motion.span
          key={letter}
          aria-hidden
          className="inline-block"
          initial={reduce ? false : { y: "0.55em", opacity: 0, filter: "blur(6px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          transition={{ delay: 0.08 + i * 0.07, type: "spring", stiffness: 420, damping: 24 }}
        >
          <span className="notki-hop" style={{ "--i": i } as CSSProperties}>
            <span className="notki-glyph">{letter}</span>
          </span>
        </motion.span>
      ))}
      <span aria-hidden className="notki-caret" />
    </span>
  );
}
