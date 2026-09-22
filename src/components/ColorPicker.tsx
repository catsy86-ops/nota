import { motion } from "framer-motion";
import type { NoteColor } from "@/hooks/useNotes";

const COLORS: { value: NoteColor; label: string }[] = [
  { value: "default", label: "Domyślny" },
  { value: "coral", label: "Koral" },
  { value: "peach", label: "Brzoskwinia" },
  { value: "sand", label: "Piasek" },
  { value: "mint", label: "Mięta" },
  { value: "sage", label: "Szałwia" },
  { value: "sky", label: "Niebo" },
  { value: "lavender", label: "Lawenda" },
  { value: "rose", label: "Róża" },
];

const colorClasses: Record<NoteColor, string> = {
  default: "bg-note",
  coral: "bg-note-coral",
  peach: "bg-note-peach",
  sand: "bg-note-sand",
  mint: "bg-note-mint",
  sage: "bg-note-sage",
  sky: "bg-note-sky",
  lavender: "bg-note-lavender",
  rose: "bg-note-rose",
};

interface ColorPickerProps {
  selected: NoteColor;
  onSelect: (color: NoteColor) => void;
}

export function ColorPicker({ selected, onSelect }: ColorPickerProps) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {COLORS.map((c) => (
        <motion.button
          key={c.value}
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onSelect(c.value)}
          className={`w-7 h-7 rounded-full border-2 transition-colors ${colorClasses[c.value]} ${
            selected === c.value ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-muted-foreground/30"
          }`}
          title={c.label}
        />
      ))}
    </div>
  );
}

export { colorClasses };
