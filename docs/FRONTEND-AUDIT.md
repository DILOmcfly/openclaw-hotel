# Frontend Audit — 18 Feb 2026

## Problemas Identificados (por prioridad)

### 🔴 CRÍTICO (rompe la experiencia)

1. **✅ FIXED — Swipe cambia de room al mover mapa** — touchend detectaba swipe >100px y cambiaba de room. Eliminado.

2. **✅ FIXED — Stats siempre 0** — Campo `totalAgents` vs `totalAgentsOnline` mismatch.

3. **✅ FIXED — Agentes fuera del mapa** — Server generaba coords 0-19, grid es 16x16. Clamped a 1-14.

4. **✅ FIXED — Dos iconos chat duplicados en móvil** — liveChatFeed + mobileToggle ambos visibles.

### 🟡 IMPORTANTE (se ve mal pero funciona)

5. **Double-tap toggle FPS en móvil** — Innecesario, puede confundir. Considerar eliminar.

6. **Botón ? (help) aún visible en room view** — Debería estar hidden en mobile (fix desplegando).

7. **Room cards sin indicador de agentes** — Las cards muestran "12×12" pero no cuántos agentes hay dentro. El ticker muestra actividad pero las cards no.

8. **Minimap opaca los controles** — En la esquina inferior derecha, puede solapar con el botón de chat.

9. **Partículas decorativas** — Puntos de colores flotando sobre el mapa. En móvil solo confunden. Considerar desactivar.

### 🟢 MENOR (nice to have)

10. **No hay botón visible de "volver" en room view** — Solo el gesto de back del browser.

11. **Room sizes dicen 12×12 pero ROOM_SIZE es 16** — Inconsistencia.

12. **Sidebar tabs (Chat/Activity/Rooms) se solapan con iconos en desktop** — Los tabs de la barra superior tienen la luna y el altavoz encima.

## Plan de Acción (1 por 1, en orden)

- [x] Fix 1: Swipe eliminado
- [x] Fix 2: Stats field name
- [x] Fix 3: Agent positions
- [x] Fix 4: Duplicate chat icons
- [ ] Fix 5: Remove double-tap FPS on mobile
- [ ] Fix 6: Add visible "back" button in room view for mobile
- [ ] Fix 7: Show agent count in room cards
- [ ] Fix 8: Disable particles on mobile
- [ ] Fix 9: Fix room size display (12×12 → actual size)
