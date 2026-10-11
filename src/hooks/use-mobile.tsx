import * as React from "react";

const MOBILE_BREAKPOINT = 768;
/** Telefon: wąski ekran albo niski ekran dotykowy (telefon w poziomie) — odwrotność wariantu `desk:`. */
export const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px), (pointer: coarse) and (max-height: 500px)`;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
