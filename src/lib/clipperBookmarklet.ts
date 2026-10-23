/**
 * Web clipper jako zakładka: kod `javascript:` otwiera `/share` tej aplikacji
 * z tytułem, adresem i zaznaczonym fragmentem aktualnej strony — dalej działa
 * ten sam tor co „Udostępnij → G” (`parseShare`, odsiew powtórzeń).
 */
export const CLIPPER_MAX_SELECTION = 5000;

export function buildClipperBookmarklet(origin: string): string {
  const base = JSON.stringify(`${origin.replace(/\/+$/, "")}/share`);
  const body =
    `var s=String(window.getSelection?window.getSelection():"").slice(0,${CLIPPER_MAX_SELECTION});` +
    `var q="?title="+encodeURIComponent(document.title)+"&url="+encodeURIComponent(location.href)+"&text="+encodeURIComponent(s);` +
    `window.open(${base}+q,"_blank","noopener");`;
  return `javascript:(function(){${body}})();`;
}
