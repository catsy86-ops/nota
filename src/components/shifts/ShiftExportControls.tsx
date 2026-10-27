import { CalendarArrowDown, FileSpreadsheet, Image as ImageIcon, Share2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ImageTheme } from "@/lib/shifts/monthImageDraw";
import { TOOLBAR_BTN } from "./shiftControlStyles";


const IMAGE_THEME_LABEL: Record<ImageTheme, string> = { light: "jasny", dark: "ciemny", style: "aktywny styl" };

export interface ShiftExportHandlers {
  onCsv: () => void;
  onSiteCsv: () => void;
  onIcs: () => void;
  /** Motyw `undefined` = motyw ustawiony w pasku. */
  onImage: (theme?: ImageTheme) => void;
}

/** Telefon: wszystkie eksporty w jednym menu „Udostępnij” (K-…, G3.2). */
export function ShiftExportMenu({ onCsv, onSiteCsv, onIcs, onImage }: ShiftExportHandlers) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={TOOLBAR_BTN}>
          <Share2 className="w-4 h-4" /> Udostępnij
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onSelect={() => onCsv()}>
          <FileSpreadsheet className="w-4 h-4 mr-2" aria-hidden /> Karta czasu (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSiteCsv()}>
          <FileSpreadsheet className="w-4 h-4 mr-2" aria-hidden /> Godziny na budowach (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onIcs()}>
          <CalendarArrowDown className="w-4 h-4 mr-2" aria-hidden /> Do kalendarza (.ics)
        </DropdownMenuItem>
        {(["light", "dark", "style"] as const).map((t) => (
          <DropdownMenuItem key={t} onSelect={() => { onImage(t); }}>
            <ImageIcon className="w-4 h-4 mr-2" aria-hidden /> Obraz miesiąca — {IMAGE_THEME_LABEL[t]} (.png)
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Komputer: eksporty w pasku z wyborem motywu obrazu. */
export function ShiftExportToolbar({ imageTheme, onImageTheme, onCsv, onSiteCsv, onIcs, onImage }: ShiftExportHandlers & { imageTheme: ImageTheme; onImageTheme: (t: ImageTheme) => void }) {
  return (
    <>
      <button type="button" onClick={onCsv}
        className={TOOLBAR_BTN}>
        <FileSpreadsheet className="w-4 h-4" /> Karta czasu (.csv)
      </button>
      <button type="button" onClick={onSiteCsv}
        className={TOOLBAR_BTN}>
        <FileSpreadsheet className="w-4 h-4" /> Godziny na budowach (.csv)
      </button>
      <button type="button" onClick={onIcs}
        className={TOOLBAR_BTN}>
        <CalendarArrowDown className="w-4 h-4" /> Do kalendarza (.ics)
      </button>
      <select aria-label="Motyw obrazu miesiąca" value={imageTheme} onChange={(e) => onImageTheme(e.target.value as ImageTheme)}
        className="h-9 rounded-control border border-input bg-background px-2 text-sm">
        {(["light", "dark", "style"] as const).map((t) => <option key={t} value={t}>{IMAGE_THEME_LABEL[t]}</option>)}
      </select>
      <button type="button" onClick={() => onImage()}
        className={TOOLBAR_BTN}>
        <ImageIcon className="w-4 h-4" /> Obraz miesiąca (.png)
      </button>
    </>
  );
}
