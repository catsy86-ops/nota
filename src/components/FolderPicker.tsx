import { useState } from "react";
import { FolderOpen, ChevronRight, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Folder } from "@/hooks/useNotes";

const folderColorDot: Record<string, string> = {
  default: "bg-muted-foreground/40",
  coral: "bg-red-400",
  peach: "bg-orange-400",
  sand: "bg-yellow-400",
  mint: "bg-emerald-400",
  sage: "bg-green-400",
  sky: "bg-blue-400",
  lavender: "bg-purple-400",
  rose: "bg-pink-400",
};

interface FolderPickerProps {
  folders: Folder[];
  currentFolderId: string | null;
  onSelect: (folderId: string | null) => void;
}

function FolderTreeItem({ folder, folders, currentFolderId, onSelect, depth = 0 }: {
  folder: Folder; folders: Folder[]; currentFolderId: string | null; onSelect: (id: string | null) => void; depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = folders.filter((f) => f.parentId === folder.id);
  const isSelected = currentFolderId === folder.id;

  return (
    <div>
      <button
        onClick={() => onSelect(isSelected ? null : folder.id)}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors hover:bg-muted/80",
          isSelected && "bg-primary/10 text-primary"
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {children.length > 0 && (
          <ChevronRight
            className={cn("w-3 h-3 shrink-0 transition-transform", expanded && "rotate-90")}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          />
        )}
        {children.length === 0 && <span className="w-3" />}
        {folder.emoji ? (
          <span className="text-sm shrink-0">{folder.emoji}</span>
        ) : (
          <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", folderColorDot[folder.color] || folderColorDot.default)} />
        )}
        <span className="truncate flex-1 text-left">{folder.name}</span>
        {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
      </button>
      {expanded && children.map((child) => (
        <FolderTreeItem key={child.id} folder={child} folders={folders} currentFolderId={currentFolderId} onSelect={onSelect} depth={depth + 1} />
      ))}
    </div>
  );
}

export function FolderPicker({ folders, currentFolderId, onSelect }: FolderPickerProps) {
  const [open, setOpen] = useState(false);
  const rootFolders = folders.filter((f) => !f.parentId);

  if (folders.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className={cn("p-1.5 rounded-full transition-colors", currentFolderId ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-foreground/5")}
            >
              <FolderOpen className="w-4 h-4" />
            </motion.button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Folder</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-56 p-2" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-semibold text-muted-foreground px-2 pb-1">Przenieś do folderu</p>
        {currentFolderId && (
          <button
            onClick={() => { onSelect(null); setOpen(false); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted/80 mb-1"
          >
            <span className="w-3" />
            <span>— Bez folderu —</span>
          </button>
        )}
        {rootFolders.map((f) => (
          <FolderTreeItem key={f.id} folder={f} folders={folders} currentFolderId={currentFolderId} onSelect={(id) => { onSelect(id); setOpen(false); }} />
        ))}
      </PopoverContent>
    </Popover>
  );
}

export { folderColorDot };
