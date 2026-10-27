import type { Dispatch, SetStateAction } from "react";
import { LoaderCircle, PenTool, Type, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoteImage } from "@/components/NoteImage";
import { cn } from "@/lib/utils";
import { CAPTION_MAX } from "@/lib/study/photoCaption";

/**
 * Pasek zdjęć wpisu w arkuszu i formularz podpisu pod nim (§5.5). Stan wpisu zostaje w arkuszu;
 * tu tylko pokazujemy zdjęcia i zgłaszamy akcje (usuń, podpis, rysuj).
 */
const CAPTION_CHIPS = ["Przed zakryciem", "Łazienka", "Kuchnia", "Kotłownia"];

export function PhotoStrip({ images, captions, processing, captioning, captionDraft, onCaptionDraft, onToggleCaption, onCancelCaption, onSubmitCaption, onRemoveCaption, onDraw, onRemove }: {
  images: string[];
  /** Podpisy zdjęć wpisu (ref → tekst); pokazane pod paskiem, wypalane dopiero przy eksporcie. */
  captions: Record<string, string>;
  processing: number;
  captioning: string | null;
  captionDraft: string;
  onCaptionDraft: Dispatch<SetStateAction<string>>;
  onToggleCaption: (ref: string) => void;
  onCancelCaption: () => void;
  onSubmitCaption: (ref: string) => void;
  onRemoveCaption: (ref: string) => void;
  onDraw: (ref: string) => void;
  onRemove: (ref: string) => void;
}) {
  return (
    <>
      {(images.length > 0 || processing > 0) && (
        <ul className="flex flex-wrap gap-2" aria-label="Zdjęcia we wpisie">
          {images.map((ref, i) => (
            <li key={ref} className="relative">
              <NoteImage imageRef={ref} alt={`Zdjęcie ${i + 1} z ${images.length} we wpisie`} className="h-20 w-20 rounded-field object-cover" placeholderClassName="h-20 w-20 rounded-field" />
              <button
                type="button"
                onClick={() => onRemove(ref)}
                aria-label="Usuń zdjęcie z wpisu"
                className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-destructive text-destructive-foreground coarse:h-6 coarse:w-6 relative coarse:after:absolute coarse:after:-inset-2.5 coarse:after:content-['']"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onToggleCaption(ref)}
                aria-label="Podpis na zdjęciu"
                aria-pressed={captioning === ref}
                className={cn(
                  "absolute -bottom-1.5 -left-1.5 grid h-6 w-6 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm coarse:h-6 coarse:w-6 relative coarse:after:absolute coarse:after:-inset-2.5 coarse:after:content-['']",
                  captioning === ref && "border-primary bg-primary text-primary-foreground",
                )}
              >
                <Type className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onDraw(ref)}
                aria-label="Rysuj na zdjęciu"
                title="Strzałka, wymiar, zaznaczenie — rysunek zostaje na zdjęciu"
                className="absolute -bottom-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm coarse:h-6 coarse:w-6 relative coarse:after:absolute coarse:after:-inset-2.5 coarse:after:content-['']"
              >
                <PenTool className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
          {Array.from({ length: processing }, (_, i) => (
            <li key={`processing-${i}`} className="grid h-20 w-20 place-items-center rounded-field bg-muted" data-testid="journal-photo-processing">
              <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
              <span className="sr-only">Przygotowuję zdjęcie</span>
            </li>
          ))}
        </ul>
      )}
      {images.some((r) => captions[r]) && (
        <ul className="space-y-0.5 text-xs text-muted-foreground" aria-label="Podpisy zdjęć">
          {images.map((r, i) => (captions[r] ? <li key={r}>Zdjęcie {i + 1}: {captions[r]}</li> : null))}
        </ul>
      )}
      {captioning && images.includes(captioning) && (
        <form
          className="space-y-2 rounded-card border border-primary/40 bg-primary/5 p-3"
          onSubmit={(ev) => { ev.preventDefault(); onSubmitCaption(captioning); }}
          aria-label="Podpis na zdjęciu"
        >
          <label className="block space-y-1 text-xs text-muted-foreground">
            Podpis na zdjęciu — dopiszę datę wpisu
            <input
              autoFocus
              value={captionDraft}
              maxLength={CAPTION_MAX}
              onChange={(ev) => onCaptionDraft(ev.target.value)}
              placeholder="np. Łazienka, pion 58 cm od posadzki"
              className="w-full rounded-field border border-input bg-background px-3 py-2 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring sm:text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CAPTION_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => onCaptionDraft((d) => (d.trim() ? d.trim() + ", " + chip.toLowerCase() : chip))}
                className="pressable rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted coarse:min-h-11 coarse:px-3 coarse:text-sm"
              >
                {chip}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={processing > 0} className="coarse:h-11">Zapisz podpis</Button>
            <Button type="button" size="sm" variant="ghost" onClick={onCancelCaption} className="coarse:h-11">Anuluj</Button>
            {captioning && captions[captioning] && <Button type="button" size="sm" variant="ghost" onClick={() => onRemoveCaption(captioning)} className="coarse:h-11">Usuń podpis</Button>}
          </div>
        </form>
      )}
    </>
  );
}
