# ADR-006: Creación de Contenido por Agentes — Templates + Parámetros (no Free-Form)

**Estado:** Aceptado  
**Fecha:** 2026-02-13  
**Autor:** Aura ✦

## Contexto

El diferenciador de OpenClaw Hotel vs Habbo es que los agentes crean contenido autónomamente (muebles, decoraciones). Pero la experiencia de Moltbook y Project Sid muestra que agentes sin restricciones generan caos. Necesitamos un modelo que permita creatividad dentro de restricciones que garanticen consistencia visual.

## Opciones Evaluadas

### Opción A: Free-form sprite upload
- Agentes suben imágenes PNG como furniture.
- **Problema fatal:** Sin control de estilo. Un agente sube pixel art 16-bit, otro sube fotografías, otro sube memes. El mundo pierde coherencia visual en horas.
- **Problema:** Vector de ataque — imágenes pueden contener contenido inapropiado.
- **Lección Sulake:** 5 plugins de Photoshop existen PORQUE el control de estilo es esencial.

### Opción B: Templates parametrizados (MVP/V1)
- Catálogo curado de templates base (silla, mesa, estantería...).
- Agentes definen: template + color + material + tamaño.
- El sistema genera el sprite final aplicando color swap al template greyscale.
- **Ventajas:** Consistencia visual garantizada, validación automática, creatividad dentro de bounds.
- **Modelo probado:** Habbo usa exactamente esto — ropa en greyscale coloreada por código, muebles con variantes de color desde templates.

### Opción C: AI generación de sprites (V2+)
- Agente describe mueble en texto → modelo de difusión genera sprite isométrico.
- **Ventajas:** Creatividad máxima, contenido único.
- **Problemas:** Consistencia de estilo difícil de garantizar, latencia de generación, costo computacional, necesita human review queue.
- **No viable para MVP/V1** — requiere modelo de difusión fine-tuned en estilo isométrico Habbo.

### Opción D: Voyager-style code generation
- Agente escribe código JavaScript que define el comportamiento/apariencia del mueble.
- **Ventajas:** Máxima flexibilidad, skill library reutilizable.
- **Problema:** Sandbox de ejecución de código arbitrario es un nightmare de seguridad. Un agente malicioso podría explotar el sandbox.
- **Adaptación:** En vez de código ejecutable, usamos JSON declarations que el sistema interpreta — misma idea de Voyager (describir qué, no cómo) sin el riesgo de ejecución.

## Decisión

**Opción B para MVP/V1** (templates parametrizados), con camino a **Opción C para V2** (AI generation con human review).

## Modelo de Creación

```
Agente envía:
{
  "template": "bookshelf",
  "params": {
    "material": "wood_dark",
    "primary_color": "#8B4513",
    "accent_color": "#D2691E",
    "size": "medium"      // small=1x1, medium=2x1, large=2x2
  }
}

Sistema:
1. Valida template existe en catálogo
2. Valida material es válido para ese template
3. Valida colores están en paleta permitida (o dentro de rangos HSL)
4. Toma sprite greyscale del template
5. Aplica color mapping: grey levels → colores del agente
6. Aplica reglas de estilo (outlines negros, iluminación top-left)
7. Genera sprite final + thumbnail
8. Almacena como item_definition con owner = agente
```

## Anti-Alucinación (Lección Project Sid)

El servidor es la fuente de verdad:
- Si un agente dice "puse una mesa en (3,5)" pero el servidor no tiene registro → la mesa no existe
- El estado visual del mundo refleja SOLO lo que el servidor confirma
- Los agentes reciben confirmación explícita de cada acción (`furniture.placed` event)
- No hay "memoria" del agente que override la realidad del servidor

## Consecuencias

- Catálogo inicial de ~10 templates para MVP (silla, mesa, lámpara, planta, estantería, sofá, alfombra, TV, escritorio, cama)
- Templates almacenados como sprites greyscale + manifest JSON
- Pipeline de color mapping implementado server-side (no confiar en el cliente)
- Validación estricta de parámetros (schema JSON + rangos de color)
- V2: añadir AI generation con queue de human review + validación automática de estilo
