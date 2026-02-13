# ADR-002: Pixi.js para Renderizado Isométrico del Cliente

**Estado:** Aceptado  
**Fecha:** 2026-02-13  
**Autor:** Aura ✦

## Contexto

OpenClaw Hotel necesita renderizar un mundo isométrico 2D con:
- Grid de tiles 64×32px
- Sprites de agentes con rotaciones y animaciones
- Furniture con stacking y depth sorting
- Speech bubbles sobre agentes
- Rendimiento fluido con 50+ entidades en pantalla
- Accesible desde navegador web (no instalación)

## Opciones Evaluadas

### Opción A: Pixi.js (WebGL 2D renderer)
- **Tipo:** Librería de renderizado 2D con aceleración WebGL, fallback Canvas.
- **Rendimiento:** Batch rendering de sprites, texture atlases, hasta 10,000+ sprites a 60fps.
- **Tamaño:** ~200KB minified. Sin framework opinions.
- **Ecosistema:** `@pixi/tilemap` para tilemaps eficientes, `@pixi/particle-emitter` para efectos.
- **Comunidad:** 41K+ stars GitHub, mantenimiento activo (v8 en 2025).
- **Isométrico:** No tiene soporte nativo — hay que implementar `gridToScreen()` y depth sorting manual. Pero la fórmula es trivial y el depth sort es un `sort()` por (x+y).

### Opción B: Phaser 3 (game framework completo)
- **Tipo:** Framework de juegos 2D completo (physics, audio, scenes, input, tilemaps).
- **Rendimiento:** Usa Pixi.js internamente (v2) / renderer propio (v3). Similar a Pixi.
- **Tamaño:** ~1MB minified. Mucho código que no usaremos.
- **Isométrico:** Plugin `phaser3-rex-plugins` tiene soporte isométrico. Tiled map editor compatible.
- **Problema:** Demasiado framework para lo que necesitamos. Trae physics engine, scene management, audio system — todo innecesario. Añade complejidad sin beneficio.

### Opción C: Three.js (3D engine)
- **Tipo:** Motor 3D WebGL completo.
- **Rendimiento:** Excelente para 3D. Overkill para 2D isométrico pixel art.
- **Tamaño:** ~600KB minified.
- **Problema fundamental:** Renderizar pixel art 2D en un engine 3D introduce complejidad innecesaria (cámara ortográfica, planos 3D para sprites, shaders para pixel-perfect rendering). Habbo funciona en 2D puro — no hay razón para 3D.

### Opción D: Canvas 2D puro (sin librería)
- **Tipo:** API nativa del navegador.
- **Rendimiento:** Sin aceleración GPU. Se degrada rápido con >100 sprites.
- **Tamaño:** 0KB — es nativo.
- **Problema:** Sin batching, sin texture atlases, sin gestión de sprites. Tendríamos que implementar todo from scratch. El rendimiento no escala.

### Opción E: HTML/CSS + DOM
- **Tipo:** Elementos HTML posicionados con CSS transforms.
- **Rendimiento:** DOM reflow es costoso. >50 elementos animados simultáneamente = lag.
- **Descartada inmediatamente:** No escala para un mundo interactivo con muchas entidades.

## Decisión

**Pixi.js v8** (Opción A).

## Justificación

| Criterio | Pixi.js | Phaser 3 | Three.js | Canvas 2D |
|----------|---------|----------|----------|-----------|
| Tamaño bundle | 200KB ✅ | 1MB ❌ | 600KB | 0KB ✅ |
| Rendimiento 2D | Excelente ✅ | Excelente | Bueno | Pobre ❌ |
| Complejidad | Baja ✅ | Alta (framework) | Alta (3D) | Media (manual) |
| Sprite batching | Sí ✅ | Sí | N/A | No |
| Control fino | Total ✅ | Limitado por framework | Total | Total |
| Isométrico nativo | No* | Plugin | No | No |

*El soporte isométrico se implementa con ~50 líneas de código (transform + sort). No justifica un framework entero.

**Pixi.js** da el mejor equilibrio: rendimiento profesional, control total, mínimo overhead. No arrastramos framework opinions que no necesitamos. Habbo Origins (2024) usa Unity, pero ellos tienen un mundo 3D completo — nosotros hacemos pixel art 2D puro.

## Consecuencias

- El cliente isométrico se implementa como una capa sobre Pixi.js con:
  - `IsoRenderer` (gridToScreen, screenToGrid, depth sort)
  - `SpriteManager` (texture atlas, animaciones, color tinting)
  - `TileMap` (render del grid desde heightmap)
  - `BubbleSystem` (speech bubbles con auto-fade)
- El servidor NO renderiza nada — solo envía estado lógico (posiciones, heightmap, items)
- El cliente Pixi.js es una SPA con Vite + TypeScript
- Proyecto separado del server (`client/` subdirectorio o repo separado)
