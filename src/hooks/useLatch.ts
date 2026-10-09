import { useState } from "react";

/**
 * `true` od pierwszego `flag === true` na zawsze. Do montowania ciężkich
 * części (dialogi w każdej karcie) dopiero przy pierwszym użyciu — potem
 * zostają w drzewie, więc animacja zamknięcia działa jak wcześniej.
 */
export function useLatch(flag: boolean): boolean {
  const [latched, setLatched] = useState(flag);
  if (flag && !latched) setLatched(true);
  return latched || flag;
}
