import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Coffee, Brain, X } from "lucide-react";
import { celebrate } from "@/lib/celebrate";
import { toast } from "sonner";
import { wordsPl } from "@/lib/plural";
import { useWakeLock } from "@/hooks/useWakeLock";

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
  // Zegar z performance.now() (plan mobile A3 / 4.5): koniec liczony z czasu, nie z liczby tików,
  // więc tło przeglądarki nie wydłuża sesji. `leftRef` pamięta resztę po pauzie.
  const endAtRef = useRef(0);
  const leftRef = useRef(WORK_MIN * 60);
  // Ekran nie gaśnie w trakcie sesji skupienia.
  useWakeLock(open);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setContent(initialContent);
    }
  }, [open, initialTitle, initialContent]);

  useEffect(() => {
    if (!running) return;
    endAtRef.current = performance.now() + leftRef.current * 1000;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endAtRef.current - performance.now()) / 1000));
      leftRef.current = left;
      if (left > 0) { setSeconds(left); return; }
      window.clearInterval(id);
      setRunning(false);
      const next = mode === "work" ? "break" : "work";
      const nextLen = (next === "work" ? WORK_MIN : BREAK_MIN) * 60;
      setMode(next);
      leftRef.current = nextLen;
      setSeconds(nextLen);
      celebrate(window.innerWidth / 2, 80);
      toast.success(next === "break" ? "Czas na przerwę ☕" : "Wracamy do pracy 🧠");
    }, 250);
    return () => {
      window.clearInterval(id);
      // Pauza: zapamiętujemy resztę z tego momentu.
      leftRef.current = Math.max(0, Math.ceil((endAtRef.current - performance.now()) / 1000));
      setSeconds(leftRef.current);
    };
  }, [running, mode]);

  function reset() {
    setRunning(false);
    leftRef.current = (mode === "work" ? WORK_MIN : BREAK_MIN) * 60;
    setSeconds(leftRef.current);
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
      <DialogContent className="max-w-none max-sm:max-w-none max-h-none w-screen h-dvh p-0 rounded-none border-0 bg-background flex flex-col gap-0 sm:rounded-none">
        <DialogTitle className="sr-only">Tryb skupienia</DialogTitle>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            {mode === "work" ? <Brain className="w-4 h-4 text-primary-ink" /> : <Coffee className="w-4 h-4 text-accent" />}
            <span>{mode === "work" ? "Skupienie" : "Przerwa"}</span>
          </div>
          <button type="button" onClick={close} aria-label="Zamknij tryb skupienia" className="p-2 rounded-field hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 py-6 border-b border-border/50">
          <div className="relative grid place-items-center" role="timer" aria-label={`${mode === "work" ? "Skupienie" : "Przerwa"}: zostało ${Number(m)} min ${Number(s)} s`}>
            <svg viewBox="0 0 120 120" className="h-56 w-56 max-w-[70vw] -rotate-90" aria-hidden>
              <circle cx="60" cy="60" r="54" fill="none" stroke="var(--muted)" strokeWidth="2" />
              <circle
                cx="60" cy="60" r="54" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round"
                pathLength={100} strokeDasharray={100} strokeDashoffset={100 - pct}
                style={{ transition: "stroke-dashoffset 0.25s linear" }}
              />
            </svg>
            <span className="absolute text-6xl font-display font-bold tabular-nums sm:text-7xl">{m}:{s}</span>
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
            className="w-full bg-transparent text-2xl font-display font-bold focus:outline-hidden placeholder:text-muted-foreground"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Pisz w skupieniu… nic Cię nie rozprasza."
            className="w-full min-h-[40dvh] bg-transparent text-base leading-relaxed focus:outline-hidden resize-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="px-6 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
          <span>{wordsPl(content.trim() ? content.trim().split(/\s+/).length : 0)}</span>
          <Button size="sm" onClick={close}>Zapisz i wyjdź</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
