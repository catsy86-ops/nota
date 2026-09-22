---
paths:
  - "src/api/**"
description: "Server-side rules"
---

- Nigdy nie używaj `window`, `document`, `localStorage`
- Wszystkie async funkcje mają typed catch: `catch (e: unknown)`
- DB calls tylko przez repository layer — nie raw queries w route handlers
- Każdy endpoint ma Zod schema w `src/schemas/`
