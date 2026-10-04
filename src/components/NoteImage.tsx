import { ImageOff } from "lucide-react";
import { useImageUrl } from "@/hooks/useImageUrl";
import { cn } from "@/lib/utils";

interface Props {
  /** Klucz z `imageStore` (albo data URL — np. obraz sprzed migracji). */
  imageRef: string;
  className?: string;
  /** Klasy kafla zastępczego, gdy obraz nie ma naturalnej wysokości (np. w siatce kart). */
  placeholderClassName?: string;
  loading?: "lazy" | "eager";
}

/** Obraz notatki z `imageStore`; kafel zastępczy, gdy bajty jeszcze nie dotarły na to urządzenie. */
export function NoteImage({ imageRef, className, placeholderClassName, loading = "lazy" }: Props) {
  const url = useImageUrl(imageRef);
  if (url) return <img src={url} alt="" className={className} loading={loading} />;
  return (
    <div
      role="img"
      aria-label={url === null ? "Obraz jeszcze nie dotarł na to urządzenie" : "Wczytywanie obrazu"}
      title={url === null ? "Obraz jeszcze nie dotarł na to urządzenie" : undefined}
      className={cn("flex items-center justify-center bg-muted/60 text-muted-foreground", className, placeholderClassName)}
    >
      {url === null && <ImageOff className="w-5 h-5 opacity-60" aria-hidden />}
    </div>
  );
}
