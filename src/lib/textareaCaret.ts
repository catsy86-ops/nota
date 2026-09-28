/**
 * Położenie znaku `pos` wewnątrz `textarea`, względem jej lewego górnego rogu
 * (z uwzględnieniem przewinięcia). `textarea` nie zdradza współrzędnych karetki,
 * więc budujemy niewidoczne lustro z tym samym stylem i mierzymy znacznik.
 */
const COPIED = [
  "boxSizing", "width", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "fontVariant", "lineHeight", "letterSpacing",
  "textTransform", "textIndent", "tabSize", "wordSpacing",
] as const;

export function caretCoordinates(textarea: HTMLTextAreaElement, pos: number): { top: number; left: number; height: number } {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  for (const prop of COPIED) mirror.style[prop] = style[prop];
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.overflow = "hidden";
  mirror.textContent = textarea.value.slice(0, pos);
  const marker = document.createElement("span");
  // Znak zastępczy, żeby znacznik miał wysokość także na końcu pustej linii.
  marker.textContent = textarea.value.slice(pos) || ".";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;
  const coords = {
    top: marker.offsetTop - textarea.scrollTop,
    left: marker.offsetLeft - textarea.scrollLeft,
    height: lineHeight,
  };
  document.body.removeChild(mirror);
  return coords;
}
