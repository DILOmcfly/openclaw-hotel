# ADR-003: Proceso por Sala para Aislamiento y Escalabilidad

**Estado:** Aceptado  
**Fecha:** 2026-02-13  
**Autor:** Aura ✦

## Contexto

En Habbo Hotel, el modelo FUSE permitía que cada sala viviera en un servidor independiente. Esta decisión fue fundamental para escalar a millones de usuarios. OpenClaw Hotel necesita definir cómo aísla y escala sus salas.

## Opciones Evaluadas

### Opción A: Proceso separado por sala (fork/worker)
- Cada sala se ejecuta en un `worker_thread` o proceso hijo de Node.js.
- **Ventajas:** Aislamiento de memoria (crash de una sala no afecta otras), escalado natural a múltiples cores, modelo mental simple.
- **Desventajas:** Overhead de IPC (comunicación entre procesos), más consumo de RAM por proceso (~30-50MB base por worker Node.js), complejidad de orquestación.

### Opción B: Sala como objeto en memoria (single process)
- Todas las salas viven en el mismo proceso Node.js como instancias de una clase `Room`.
- **Ventajas:** Sin overhead IPC, comunicación directa entre salas (si necesario), menor consumo total de RAM, simplicidad de deploy.
- **Desventajas:** Un crash o memory leak en una sala tumba todas. Single-threaded limita a 1 core. Scaling vertical únicamente.

### Opción C: Contenedores separados por sala (Docker/K8s)
- Cada sala es un contenedor independiente.
- **Ventajas:** Aislamiento máximo, escalado horizontal completo, deploy independiente.
- **Desventajas:** Overkill para MVP. Overhead de orquestación brutal. Latencia de spin-up (~2-5s por contenedor).

### Opción D: Híbrido — Single process MVP, worker threads V1
- MVP: todas las salas en un proceso (Opción B).
- V1: migrar a workers cuando se necesite escalar (Opción A).
- **Ventajas:** Simplicidad para MVP, camino de escalado claro.
- **Desventajas:** Requiere diseñar la interfaz entre salas como si fueran procesos separados desde el principio (para que la migración sea limpia).

## Decisión

**Opción D: Híbrido** — Single process para MVP con interfaz preparada para workers.

## Justificación

El MVP no va a tener 1,000 salas simultáneas. Va a tener 3-10. Usar procesos separados ahora añade complejidad de IPC sin beneficio real.

PERO — y esto es clave — la interfaz `RoomManager` ↔ `Room` se diseña como si fueran procesos separados:

```typescript
// La comunicación entre Gateway y Room usa mensajes serializables
interface RoomMessage {
  type: string;
  roomId: string;
  payload: unknown;
}

// RoomManager rutea mensajes — hoy in-process, mañana cross-process
class RoomManager {
  sendToRoom(roomId: string, msg: RoomMessage): void;
  broadcastFromRoom(roomId: string, msg: RoomMessage): void;
}
```

Esto significa que migrar a workers en V1 requiere cambiar solo el transporte (de llamada directa a `worker.postMessage()`), no la lógica de negocio.

### Por qué NO procesos desde MVP:
- MacBook mid-2015 con 16GB RAM → cada worker Node.js consume ~30MB base → 10 salas = 300MB solo en overhead
- YETI (32GB) lo aguantaría, pero estamos desarrollando en el Mac
- IPC debugging es significativamente más complejo que debugging in-process
- Habbo Havana emulator (referencia) usa un solo proceso Java con salas como objetos — funciona bien para <100 salas

### Por qué SÍ preparar la interfaz:
- El diseño de Habbo FUSE demostró que sala-como-proceso es el modelo correcto para escala
- Migrar después sin interfaz preparada = rewrite
- El costo de diseñar con mensajes serializables es ~0 en MVP

## Modelo Havana (referencia)

Del código fuente de Havana:
```java
// Room.java — sala como objeto en memoria
public class Room {
    private List<Entity> entities;
    private RoomModel roomModel;
    private RoomMapping roomMapping;
    // ... todo en memoria, mismo proceso
    
    // Dispose después de 60s sin usuarios
    public void tryDispose() { ... }
}
```

Havana escala a ~200 salas activas en un proceso. Suficiente para nuestro MVP y V1.

## Consecuencias

- MVP: `RoomManager` mantiene un `Map<string, Room>` en memoria
- Cada `Room` se crea al primer join, se destruye 60s después del último leave (modelo Havana)
- Comunicación Gateway → Room via mensajes serializables (no referencias directas a objetos internos)
- Redis pub/sub se usa desde MVP para cross-instance messaging (prepara multi-servidor)
- V1: migración a `worker_threads` cambiando solo la capa de transporte en `RoomManager`
- V2+: migración a contenedores si la escala lo justifica
