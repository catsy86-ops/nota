/**
 * Otwarta analiza w adresie (`/praca?analiza=<id>`): odświeżenie zostaje w edytorze, „wstecz” wraca do listy.
 * Osobny moduł, żeby Praca znała parametr bez statycznego importu Planów (leniwy fragment poza precache, D2).
 */
export const PLAN_PARAM = "analiza";
