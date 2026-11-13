/**
 * Czy tekst może zawierać wzór `$…$` albo `$$…$$` (plan Notatek 5.4). Reguła jak w Pandoc: po otwierającym `$` nie ma
 * spacji, przed zamykającym nie ma spacji, a po zamykającym nie stoi cyfra — dzięki temu „kosztuje $5 i $10” nie jest
 * wzorem. Biblioteka wzorów (KaTeX, kilkaset KB z krojami) ładuje się tylko, gdy ten test przejdzie.
 */
const MATH_HINT = /\$\$|(?<![\\$])\$(?![\s$])[^$\n]*[^\s$\\]\$(?!\d)|(?<![\\$])\$[^\s$\\]\$(?!\d)/;

export function hasMath(content: string): boolean {
  return content.includes("$") && MATH_HINT.test(content);
}
