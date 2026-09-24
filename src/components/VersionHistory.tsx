import { useState } from "react";
import { History, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import type { NoteVersion } from "@/hooks/useNoteVersions";

interface VersionHistoryProps {
  versions: NoteVersion[];
  onRestore: (version: NoteVersion) => void;
}

export function VersionHistory({ versions, onRestore }: VersionHistoryProps) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (versions.length === 0) return null;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
            className="p-1.5 rounded-full text-muted-foreground hover:bg-foreground/5 transition-colors"
          >
            <History className="w-4 h-4" />
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Historia wersji ({versions.length})</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <History className="w-5 h-5" />
              Historia wersji
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {versions.map((v, i) => (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="border border-border/50 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">
                      {v.title || <span className="text-muted-foreground italic">Bez tytułu</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(v.timestamp), "d MMM yyyy, HH:mm", { locale: pl })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {expandedId === v.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                <AnimatePresence>
                  {expandedId === v.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 space-y-2">
                        <div className="bg-muted/30 rounded-lg p-2 max-h-40 overflow-y-auto">
                          {v.content ? (
                            <MarkdownRenderer content={v.content} className="text-xs" />
                          ) : (
                            <p className="text-xs text-muted-foreground italic">Brak treści</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-2 text-xs"
                          onClick={(e) => { e.stopPropagation(); onRestore(v); setOpen(false); }}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Przywróć tę wersję
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
