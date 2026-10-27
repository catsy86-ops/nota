import { useCallback, useEffect, useRef, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ArrowUpRight, FilePlusCorner } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createNoteWithTitle, lookupWikiTarget, previewLines } from "@/lib/wikiNoteActions";

interface Props {
  title: string;
  /** Nagłówek z `[[tytuł#nagłówek]]` — klik przewija czytnik do niego. */
  heading?: string | null;
  /** Tekst z `[[cel|tekst]]`; bez niego pokazujemy cel. */
  label?: string | null;
  exists: boolean;
  onWikiClick?: (title: string) => void;
}

const HOVER_OPEN_MS = 350;
const CLOSE_MS = 180;
const LONG_PRESS_MS = 450;

/** Bez znaczników Markdown — podgląd to zwykły tekst, nie drugi render. */
function plain(line: string): string {
  return line.replace(/^\s*(#{1,6}\s+|>\s?|[-*]\s+)/, "").replace(/(\*\*|__|`)/g, "");
}

/**
 * `[[link]]` z podglądem notatki docelowej: po najechaniu myszą, po fokusie
 * klawiatury i po przytrzymaniu palca. Brak notatki → jedno kliknięcie tworzy ją.
 */
export function WikiLink({ title, heading = null, label = null, exists, onWikiClick }: Props) {
  const target_ = heading ? `${title}#${heading}` : title;
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const pressTimer = useRef<number | undefined>(undefined);
  const suppressClick = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const clearTimer = () => { window.clearTimeout(timer.current); timer.current = undefined; };
  const schedule = useCallback((next: boolean, ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(next), ms);
  }, []);
  useEffect(() => () => { window.clearTimeout(timer.current); window.clearTimeout(pressTimer.current); }, []);

  const target = open ? lookupWikiTarget(title) : undefined;
  const lines = target ? previewLines(target) : [];

  function handleCreate() {
    createNoteWithTitle(title);
    setOpen(false);
    toast.success(`Utworzono notatkę „${title}”`);
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <button
          type="button"
          data-wiki-link=""
          onClick={(e) => {
            e.stopPropagation();
            if (suppressClick.current) { suppressClick.current = false; return; }
            setOpen(false);
            onWikiClick?.(target_);
          }}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse" && window.matchMedia("(hover: hover)").matches) schedule(true, HOVER_OPEN_MS);
          }}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") schedule(false, CLOSE_MS); }}
          onPointerDown={(e) => {
            if (e.pointerType !== "touch") return;
            window.clearTimeout(pressTimer.current);
            pressTimer.current = window.setTimeout(() => { suppressClick.current = true; setOpen(true); }, LONG_PRESS_MS);
          }}
          onPointerUp={() => window.clearTimeout(pressTimer.current)}
          onPointerCancel={() => window.clearTimeout(pressTimer.current)}
          onContextMenu={(e) => { if (suppressClick.current) e.preventDefault(); }}
          onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) schedule(true, 0); }}
          onBlur={(e) => {
            if (contentRef.current?.contains(e.relatedTarget as Node | null)) return;
            schedule(false, CLOSE_MS);
          }}
          onKeyDown={(e) => { if (e.key === "Escape" && open) { e.stopPropagation(); clearTimer(); setOpen(false); } }}
          className={cn(
            "inline px-1 rounded transition-colors font-medium",
            exists
              ? "text-accent bg-accent/10 hover:bg-accent/20"
              : "text-muted-foreground bg-muted/40 hover:bg-muted/60 italic"
          )}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          {label ?? title}
          {heading && <span className="text-muted-foreground font-normal"> › {heading}</span>}
        </button>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          ref={contentRef}
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerEnter={clearTimer}
          onPointerLeave={() => schedule(false, CLOSE_MS)}
          onClick={(e) => e.stopPropagation()}
          data-wiki-preview=""
          className={cn(
            "z-toast w-72 max-w-[calc(100vw-1.5rem)] rounded-field border border-border/70 bg-popover text-popover-foreground shadow-elevation-3 outline-hidden",
            "border-l-[3px] border-l-primary/60 px-3 py-2.5 text-left",
            "duration-fast ease-out-soft data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        >
          {target ? (
            <>
              <p className="font-display text-sm font-semibold leading-snug text-foreground truncate">{target.title.trim() || "Bez tytułu"}</p>
              {lines.length > 0 ? (
                <div className="mt-1.5 space-y-0.5 text-xs leading-relaxed text-foreground/75" data-wiki-preview-body="">
                  {lines.map((l, i) => <p key={i} className="line-clamp-2 wrap-break-word">{plain(l)}</p>)}
                </div>
              ) : (
                <p className="mt-1.5 text-xs italic text-muted-foreground">Pusta notatka.</p>
              )}
              <button
                type="button"
                onClick={() => { setOpen(false); onWikiClick?.(target_); }}
                className="pressable mt-2 inline-flex items-center gap-1 rounded-control bg-primary/10 px-2 py-1 text-xs font-medium text-primary-ink hover:bg-primary/20 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                Otwórz <ArrowUpRight className="h-3 w-3" aria-hidden />
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Notatka „{title}” jeszcze nie istnieje.</p>
              <button
                type="button"
                onClick={handleCreate}
                className="pressable mt-2 inline-flex items-center gap-1.5 rounded-control bg-primary/10 px-2 py-1 text-xs font-medium text-primary-ink hover:bg-primary/20 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                <FilePlusCorner className="h-3.5 w-3.5" aria-hidden /> Utwórz notatkę „{title}”
              </button>
            </>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
