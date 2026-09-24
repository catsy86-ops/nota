import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Coffee, Brain, X } from "lucide-react";
import { motion } from "framer-motion";
import { celebrate } from "@/lib/celebrate";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTitle?: string;
  initialContent?: string;
  onSave?: (title: string, content: string) => void;
}

const WORK_MIN = 25;
const BREAK_MIN = 5;

export function FocusMode({ open, onOpenChange, initialTitle = "", initialContent = "", onSave }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [seconds, setSeconds] = useState(WORK_MIN * 60);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<"work" | "break">("work");
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setContent(initialContent);
    }
  }, [open, initialTitle, initialContent]);

  useEffect(() => {
    if (!running) return;
    tickRef.current = window.setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          window.clearInterval(tickRef.current!);
          setRunning(false);
          const next = mode === "work" ? "break" : "work";
          setMode(next);
          setSeconds((next === "work" ? WORK_MIN : BREAK_MIN) * 60);
          celebrate(window.innerWidth / 2, 80);
          toast.success(next === "break" ? "Czas na przerwę ☕" : "Wracamy do pracy 🧠");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [running, mode]);

  function reset() {
    setRunning(false);
    setSeconds((mode === "work" ? WORK_MIN : BREAK_MIN) * 60);
  }

  function close() {
    if (onSave && (title.trim() || content.trim())) {
      onSave(title.trim(), content.trim());
    }
    onOpenChange(false);
    setRunning(false);
  }

  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  const totalSec = (mode === "work" ? WORK_MIN : BREAK_MIN) * 60;
  const pct = ((totalSec - seconds) / totalSec) * 100;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-none w-screen h-screen p-0 rounded-none border-0 bg-background flex flex-col gap-0 sm:rounded-none">
        <DialogTitle className="sr-only">Tryb skupienia</DialogTitle>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            {mode === "work" ? <Brain className="w-4 h-4 text-primary" /> : <Coffee className="w-4 h-4 text-accent" />}
            <span>{mode === "work" ? "Skupienie" : "Przerwa"}</span>
          </div>
          <button onClick={close} className="p-2 rounded-lg hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 py-6 border-b border-border/50">
          <motion.div
            key={`${m}${s}`}
            initial={{ scale: 0.96, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-6xl sm:text-7xl font-display font-bold tabular-nums"
          >
            {m}:{s}
          </motion.div>
          <div className="w-64 max-w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <motion.div className="h-full bg-primary" animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={running ? "secondary" : "default"} onClick={() => setRunning((r) => !r)}>
              {running ? <Pause className="w-4 h-4 mr-1.5" /> : <Play className="w-4 h-4 mr-1.5" />}
              {running ? "Pauza" : "Start"}
            </Button>
            <Button size="sm" variant="outline" onClick={reset}>
              <RotateCcw className="w-4 h-4 mr-1.5" /> Reset
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6 max-w-3xl mx-auto w-full space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tytuł…"
            className="w-full bg-transparent text-2xl font-display font-bold focus:outline-none placeholder:text-muted-foreground/40"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Pisz w skupieniu… nic Cię nie rozprasza."
            className="w-full min-h-[40vh] bg-transparent text-base leading-relaxed focus:outline-none resize-none placeholder:text-muted-foreground/40"
          />
        </div>

        <div className="px-6 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
          <span>{content.trim() ? `${content.trim().split(/\s+/).length} słów` : "0 słów"}</span>
          <Button size="sm" onClick={close}>Zapisz i wyjdź</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
