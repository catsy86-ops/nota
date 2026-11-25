// S1.1: service worker podlega tej samej CSP co strona (nagłówek "/(.*)"), więc `require-trusted-types-for 'script'`
// blokuje w nim `importScripts("sw-notifications.js", …)` i ładowanie fragmentów Workboxa, jeśli nie ma polityki.
// Workbox generuje sw.js bez miejsca na własny kod przed `importScripts`, dlatego po buildzie dopisujemy na początek
// politykę `default`: adresy skryptów tylko z własnego źródła (tyle i tak dopuszcza `script-src 'self'`), nic więcej.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const SW_TT_MARK = "/* S1.1 trusted-types */";
export const SW_TT_POLICY =
  `${SW_TT_MARK}self.trustedTypes&&self.trustedTypes.createPolicy("default",{createScriptURL:function(u){try{return new URL(u,self.location.href).origin===self.location.origin?u:null}catch(e){return null}}});\n`;

export function withPolicy(source) {
  return source.startsWith(SW_TT_MARK) ? source : SW_TT_POLICY + source;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.endsWith("sw-trusted-types.mjs")) {
  const file = resolve(process.argv[2] ?? "dist/sw.js");
  writeFileSync(file, withPolicy(readFileSync(file, "utf8")));
  console.log(`sw-trusted-types: polityka dopisana do ${file}`);
}
