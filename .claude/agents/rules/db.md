---
paths:
  - "prisma/**"
description: "Database rules"
---

- Zmiana schema = zawsze `npx prisma migrate dev` (nie `db push` w prod)
- Nowe kolumny: zawsze z `default` lub `nullable` (nie breaking)
- Indeksy: dodawaj przy każdej nowej relacji używanej w WHERE/JOIN
- NIE usuwaj kolumn — soft delete + deprecate
