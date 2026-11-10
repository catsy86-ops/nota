import { useEffect, useState } from "react";
import { AlertCircle, Sparkles, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { hasAISummarizer, summarizeText } from "@/lib/aiModel";
import { toast } from "sonner";

interface AISummaryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  /** Zwraca streszczenie (opcjonalnie do zapisu). */
  onSelect?: (summary: string) => void;
}

export function AISummary({ open, onOpenChange, text, onSelect }: AISummaryProps) {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !text.trim()) return;
    if (!hasAISummarizer()) {
      setSupported(false);
      return;
    }

    setLoading(true);
    summarizeText(text, "tl;dr")
      .then((result) => {
        if (result) {
          setSummary(result);
        } else {
          setSupported(false);
        }
      })
      .catch(() => {
        setSupported(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, text]);

  function copy() {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Skopiowano do schowka");
  }

  function use() {
    if (!summary) return;
    onSelect?.(summary);
    onOpenChange(false);
    toast.success("Streszczenie dodane do wpisu");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-sm" data-testid="ai-summary">
        <div className="border-b border-border px-5 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <Sparkles className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden />
            Streszczenie AI
          </DialogTitle>
          <DialogDescription className="text-xs">Chrome Built-in Model, offline (B3.6)</DialogDescription>
        </div>

        <div className="space-y-3 px-5 py-4 min-h-24">
          {!supported ? (
            <div className="flex gap-3 rounded-card border border-warning bg-warning/5 p-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-warning-ink" aria-hidden />
              <div className="text-sm">AI Model niedostępny. Dostępny na Chrome 131+ na Android.</div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-pulse text-muted-foreground text-sm">Generuję streszczenie…</div>
            </div>
          ) : summary ? (
            <div className="rounded-card border border-border bg-muted p-3">
              <p className="text-sm text-foreground leading-relaxed">{summary}</p>
              <Button type="button" size="sm" variant="ghost" onClick={copy} className="mt-2 h-8 gap-1">
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    Skopiowano
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    Kopiuj
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">Brak streszczenia</div>
          )}
        </div>

        <ResponsiveDialogFooter className="grid grid-cols-2 gap-2 border-t border-border px-5 pb-5 pt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="coarse:h-11">
            Zamknij
          </Button>
          {onSelect && (
            <Button type="button" onClick={use} disabled={!summary || !supported} className="coarse:h-11">
              Użyj
            </Button>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
