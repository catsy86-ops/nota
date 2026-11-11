/** Najdłuższy bok miniatury w siatkach (80 px × ~3 gęstość ekranu). */
export const THUMB_SIDE = 256;

/**
 * Miniatura JPEG do siatek i pasków zdjęć (B5.5). `null` = nie trzeba albo nie da się (obraz już mały, brak
 * `createImageBitmap`/canvasu, uszkodzone bajty) — wołający pokazuje wtedy oryginał.
 */
export async function makeThumbBlob(bytes: ArrayBuffer, type: string, side = THUMB_SIDE): Promise<Blob | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  const bitmap = await createImageBitmap(new Blob([bytes], { type })).catch(() => null);
  if (!bitmap) return null;
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= side) return null;
    const k = side / longest;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * k));
    canvas.height = Math.max(1, Math.round(bitmap.height * k));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
  } finally {
    bitmap.close?.();
  }
}
