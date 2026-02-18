# Frontend Audit — 18 Feb 2026

## Problemas Identificados (por prioridad)

### 🔴 CRÍTICO (rompe la experiencia)

1. **✅ FIXED** — Swipe cambia de room al mover mapa (eliminado)
2. **✅ FIXED** — Stats siempre 0 (`totalAgents` vs `totalAgentsOnline`)
3. **✅ FIXED** — Agentes fuera del mapa (server coords 0-19, grid 16)
4. **✅ FIXED** — Dos iconos chat duplicados en móvil

### 🟡 IMPORTANTE (se ve mal pero funciona)

5. **✅ FIXED** — Double-tap FPS toggle eliminado
6. **✅ FIXED** — Back button prominente en móvil (fixed position, top-left)
7. **✅ FIXED** — Room cards ya mostraban agent count (verified)
8. **✅ FIXED** — Partículas desactivadas en móvil
9. **✅ FIXED** — Room size muestra 16×16 (real)
10. **✅ FIXED** — Help/feedback/audio/theme buttons hidden on mobile
11. **✅ FIXED** — liveChatFeed hidden on mobile (redundant with sidebar)

### 🔵 PENDIENTE (verificar en próximo test de Diego)

12. **Minimap overlap** — Reducido a 80px, 60% opacity. Verificar si molesta.
13. **Sidebar tabs en desktop** — Verificar que no se solapan con nada.
14. **Reaction panel** — ¿Se ve bien en móvil? Puede necesitar ajuste.
15. **Agent sprites** — ¿Se ven bien con los nuevos colores de room?
16. **Pan sensitivity** — El factor 0.5 en touchmove ¿es suficiente?

## Resumen de cambios (commits)

- `aa1b3f9` — Room themes, hide icons mobile, stats retry
- `2272cff` — Agent position clamp, mobile declutter
- `daa9f12` — Hide help/feedback, bottom-sheet profile, cold-start retry
- `89205cb` — Stats field fix, server position bounds, duplicate chat fix
- `95f97f9` — Remove swipe-room-change, disable particles, prominent back btn
