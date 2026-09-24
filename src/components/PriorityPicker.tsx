import { Flag } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PRIORITY_COLOR_CLASS, PRIORITY_LABELS, type NotePriority } from "@/lib/notePriority";

interface PriorityPickerProps {
  priority: NotePriority;
  onSet: (priority: NotePriority) => void;
}

const OPTIONS: NotePriority[] = ["none", "low", "medium", "high"];

export function PriorityPicker({ priority, onSet }: PriorityPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          className={cn(
            "p-1.5 rounded-full hover:bg-foreground/5 transition-colors",
            priority !== "none" ? PRIORITY_COLOR_CLASS[priority] : "text-muted-foreground"
          )}
          title="Priorytet"
        >
          <Flag className={cn("w-4 h-4", priority !== "none" && "fill-current")} />
        </motion.button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-2 space-y-1" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-semibold font-display text-muted-foreground uppercase tracking-wider px-1 pb-1">Priorytet</p>
        {OPTIONS.map((p) => (
          <button
            key={p}
            onClick={() => onSet(p)}
            className={cn(
              "w-full flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg transition-colors",
              priority === p ? "bg-primary/10 font-semibold" : "hover:bg-muted"
            )}
          >
            <Flag className={cn("w-3.5 h-3.5", p !== "none" ? PRIORITY_COLOR_CLASS[p] : "text-muted-foreground", p !== "none" && "fill-current")} />
            {PRIORITY_LABELS[p]}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function PriorityBadge({ priority }: { priority: NotePriority }) {
  if (priority === "none") return null;
  return (
    <div className={cn("flex items-center gap-1 text-[10px] mt-2 px-2 py-0.5 rounded-full w-fit bg-foreground/5", PRIORITY_COLOR_CLASS[priority])}>
      <Flag className="w-2.5 h-2.5 fill-current" />
      {PRIORITY_LABELS[priority]}
    </div>
  );
}
