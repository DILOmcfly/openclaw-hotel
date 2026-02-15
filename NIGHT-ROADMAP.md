# Night Roadmap — 15-16 Feb 2026
## Objetivo: Avanzar OpenClaw Hotel al máximo durante la noche

### FASE 1: Pixel Artist 🎨 (Priority: CRITICAL)
- [ ] T-300: Instalar rembg para background removal profesional
- [ ] T-301: Probar Perchance.org — generar 5 sprites de prueba con chroma verde
- [ ] T-302: Probar PixelLab.ai — usar 40 free generations para furniture isométrico
- [ ] T-303: Descargar assets gratuitos de itch.io (isometric furniture pack)
- [ ] T-304: Re-generar los 13 furniture sprites con la mejor herramienta encontrada
- [ ] T-305: Generar los 3 assets faltantes (metal wall, sand tile, water tile)

### FASE 2: Frontend Game Dev 🖥️ (Priority: HIGH)
- [ ] T-310: Evaluar scuti-renderer — clonar repo, analizar código, ver si es integrable
- [ ] T-311: Si scuti-renderer es viable → integrar en spectate.html (reemplazar canvas manual)
- [ ] T-312: Si no viable → mejorar renderer actual con PixiJS directamente
- [ ] T-313: Implementar animación de movimiento suave (interpolación entre tiles)
- [ ] T-314: Añadir speech bubbles estilo Habbo (globos de chat sobre agentes)

### FASE 3: AI Agent Engineer 🤖 (Priority: HIGH)
- [ ] T-320: Configurar Groq API (free tier) para diálogos de agentes
- [ ] T-321: Crear sistema de personalidades (5 agentes, 5 personalidades únicas)
- [ ] T-322: Reemplazar chat random por chat generado con LLM
- [ ] T-323: Activar loop continuo de simulación (cron cada 30-60 segundos)

### FASE 4: DevOps ⚙️ (Priority: MEDIUM — después de visual)
- [ ] T-330: Crear Dockerfile para el proyecto
- [ ] T-331: Probar deploy a Fly.io free tier
- [ ] T-332: Configurar dominio + SSL

### Roles asignados:
| Tarea | Rol | Ejecutor |
|-------|-----|----------|
| T-300 a T-305 | Pixel Artist | Sub-agente art-worker |
| T-310 a T-314 | Frontend Dev | Sub-agente frontend-worker |
| T-320 a T-323 | AI Engineer | Sub-agente ai-worker |
| T-330 a T-332 | DevOps | Sub-agente devops-worker |
| Coordinación | Project Lead | Aura (main session) |
