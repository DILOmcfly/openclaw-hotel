# TICKETS.md — Planificación Ejecutable (Fase 4)

**Versión:** 1.0.0  
**Fecha:** 2026-02-13  
**Estado:** Listo para ejecución

Cada ticket es atómico: un coding agent puede ejecutarlo sin contexto adicional más allá de este archivo y los ADRs.

**Convenciones:**
- `[ ]` = Pendiente | `[→]` = En progreso | `[✓]` = Completado | `[✗]` = Bloqueado
- Cada ticket tiene: ID, título, descripción, criterios de aceptación, dependencias
- Los tickets se ejecutan en orden dentro de cada sprint

---

## Sprint 0 — Foundation (Limpieza + Setup)

> El código existente de la fase prematura se descarta. Empezamos limpio con el diseño validado.

### T-000: Reset del repositorio
**Descripción:** Limpiar código existente (fase prematura), mantener solo research/ y architecture/.  
**Acciones:**
1. `git tag v0-premature` (preservar historia)
2. Eliminar `src/`, `package.json`, `tsconfig.json`, `vitest.config.ts` existentes
3. Mantener: `research/`, `architecture/`, `OPENCLAW_HOTEL_PLAN.md`, `TICKETS.md`
4. Commit: "chore: reset for Phase 5 — clean implementation from validated design"

**Criterios de aceptación:**
- [ ] Tag `v0-premature` existe
- [ ] Directorio `src/` eliminado
- [ ] `research/` y `architecture/` intactos
- [ ] Git clean, commit pushed

**Dependencias:** Ninguna

---

### T-001: Inicializar proyecto Node.js + TypeScript + ESM
**Descripción:** Setup del proyecto desde cero con las herramientas definidas en ADR.  
**Acciones:**
1. `npm init -y`
2. Instalar deps:
   - Runtime: `express`, `ws`, `tweetnacl`, `drizzle-orm`, `postgres`, `pino`, `jsonwebtoken`, `zod`, `ioredis`
   - Dev: `typescript`, `vitest`, `@types/express`, `@types/ws`, `@types/jsonwebtoken`, `tsx`, `drizzle-kit`
3. Crear `tsconfig.json`: strict, ESM, target ES2022, outDir dist/
4. Crear `vitest.config.ts`
5. Crear estructura de directorios:
   ```
   src/
   ├── server.ts
   ├── config.ts
   ├── db/
   │   ├── schema.ts
   │   └── seed.ts
   ├── services/
   ├── ws/
   ├── api/
   ├── utils/
   └── tests/
   client/           # (vacío por ahora, Sprint 3)
   ```
6. Scripts en package.json: `dev`, `build`, `test`, `start`
7. Crear `.env.example` con todas las vars necesarias
8. Crear `.gitignore`

**Criterios de aceptación:**
- [ ] `npm run build` compila sin errores
- [ ] `npm test` ejecuta (0 tests, 0 errors)
- [ ] Estructura de directorios creada
- [ ] `.env.example` documenta todas las variables

**Dependencias:** T-000

---

### T-002: Docker Compose — PostgreSQL + Redis
**Descripción:** Servicios de infraestructura para desarrollo local.  
**Acciones:**
1. Crear `docker-compose.yml`:
   - PostgreSQL 16 (port 5432, vol persistente)
   - Redis 7 (port 6379)
   - App service (optional, para deploy)
2. Crear `Dockerfile` multi-stage (build + runtime)
3. Health checks para ambos servicios
4. Crear script `scripts/dev-setup.sh` que levanta compose + espera healthy

**Criterios de aceptación:**
- [ ] `docker compose up -d` levanta pg + redis
- [ ] `docker compose ps` muestra ambos healthy
- [ ] Conexión desde Node.js a ambos funciona (test manual con script)

**Dependencias:** T-001

---

## Sprint 1 — Auth + Identity

### T-010: Utilidades criptográficas Ed25519
**Descripción:** Implementar `src/utils/crypto.ts` con operaciones Ed25519.  
**Ref:** ADR-001  
**Acciones:**
1. Implementar funciones:
   - `generateKeypair()` → `{ publicKey: Uint8Array, secretKey: Uint8Array }`
   - `sign(message: string, secretKey: Uint8Array)` → `Uint8Array`
   - `verify(message: string, signature: Uint8Array, publicKey: Uint8Array)` → `boolean`
   - `encodeHex(bytes: Uint8Array)` → `string`
   - `decodeHex(hex: string)` → `Uint8Array`
2. Usar `tweetnacl` (sign.keyPair, sign.detached, sign.detached.verify)
3. Tests en `src/tests/crypto.test.ts`:
   - Keypair generation produces valid 32-byte keys
   - Sign + verify roundtrip
   - Verify rejects wrong signature
   - Verify rejects wrong public key
   - Verify rejects tampered message
   - Hex encode/decode roundtrip

**Criterios de aceptación:**
- [ ] Todas las funciones implementadas
- [ ] 6+ tests passing
- [ ] 0 dependencias fuera de tweetnacl

**Dependencias:** T-001

---

### T-011: Schema de base de datos (Drizzle)
**Descripción:** Definir schema con Drizzle ORM para todas las tablas del MVP.  
**Ref:** TRD sección 6.3  
**Acciones:**
1. `src/db/schema.ts` con tablas: `agents`, `rooms`, `messages`, `presence`, `audit_log`, `bans`, `room_items`, `spectators`
2. Configurar `drizzle.config.ts`
3. Generar primera migración: `npx drizzle-kit generate`
4. Crear `src/db/index.ts` con conexión pool (postgres + drizzle)
5. Crear `src/db/seed.ts`:
   - 3 salas por defecto: Lobby (heightmap 10×10), Dev Room (5×5), The Garden (12×8)
   - Heightmaps con variedad (alturas, tiles cerrados)

**Criterios de aceptación:**
- [ ] Schema compila con TypeScript
- [ ] Migración generada y aplicable (`npx drizzle-kit push`)
- [ ] Seed script crea 3 salas con heightmaps
- [ ] Todas las tablas del TRD incluidas

**Dependencias:** T-001, T-002

---

### T-012: Auth Service — Register + Challenge-Response
**Descripción:** Implementar el flujo completo de autenticación.  
**Ref:** ADR-001, TRD sección 6.4, Sequence Diagrams §1-2  
**Acciones:**
1. `src/services/auth.ts`:
   - `registerAgent(publicKey, displayName, proof, timestamp)` → agentId
     - Verificar proof es firma válida de `REGISTER:{publicKey}:{timestamp}`
     - Verificar timestamp < 5 minutos
     - Verificar publicKey no registrada
     - Insert en agents + audit_log
   - `createChallenge(publicKey)` → challenge (32 bytes random, TTL 30s en Redis)
   - `verifyChallenge(publicKey, challenge, signature)` → JWT (1h)
     - Verificar challenge existe en Redis
     - Verificar firma
     - Generar JWT con {agentId, publicKey, exp}
     - Delete challenge de Redis
     - Insert audit_log
   - `validateToken(jwt)` → {agentId, publicKey}
2. `src/api/auth.routes.ts`:
   - `POST /api/v1/agents/register`
   - `POST /api/v1/auth/challenge`
   - `POST /api/v1/auth/verify`
   - Input validation con zod
3. Tests:
   - Register con proof válido → success
   - Register con proof inválido → 401
   - Register con pk duplicada → 409
   - Challenge → verify → JWT válido
   - Challenge expirado → 401
   - Firma inválida → 401

**Criterios de aceptación:**
- [ ] 3 endpoints funcionando
- [ ] 6+ tests passing
- [ ] Audit log registra cada operación
- [ ] JWT con expiración 1h

**Dependencias:** T-010, T-011

---

## Sprint 2 — Rooms + Grid + Pathfinding

### T-020: Room Service — CRUD + Presence
**Descripción:** Gestión de salas y tracking de presencia.  
**Ref:** TRD sección 6.1, Sequence Diagram §3  
**Acciones:**
1. `src/services/rooms.ts`:
   - `createRoom(name, description, heightmap, createdBy)` → room
   - `listRooms(filters?: {public?, limit?, offset?})` → rooms[]
   - `getRoom(roomId)` → room + occupantCount
   - `deleteRoom(roomId, deletedBy)` → success (solo creator o admin)
2. `src/services/presence.ts`:
   - `joinRoom(agentId, roomId)` → {position, occupants} (Redis SET + DB)
   - `leaveRoom(agentId, roomId)` → success
   - `getOccupants(roomId)` → agents[] with positions
   - `getAgentRoom(agentId)` → roomId | null
   - `cleanupStale(timeoutMs: 60000)` — remove agents sin heartbeat
3. REST endpoints:
   - `POST /api/v1/rooms` (auth required)
   - `GET /api/v1/rooms`
   - `GET /api/v1/rooms/:id`
4. Tests: CRUD, join/leave, stale cleanup, max occupants (50)

**Criterios de aceptación:**
- [ ] CRUD de salas funcional
- [ ] Presencia con Redis + DB backup
- [ ] Límite 50 occupants enforced
- [ ] Cleanup de stale funciona
- [ ] 8+ tests passing

**Dependencias:** T-011, T-012

---

### T-021: Grid Parser + Heightmap
**Descripción:** Parsear heightmaps estilo Havana y generar grid navegable.  
**Ref:** FASE-1 deep dive, ADR-003  
**Acciones:**
1. `src/services/grid.ts`:
   - `parseHeightmap(str: string)` → `RoomGrid` (2D array)
     - Cada char: '0'-'9' = height, 'x' = closed tile, '|' = row separator
   - `isValidTile(grid, x, y)` → boolean (dentro de bounds y no 'x')
   - `getTileHeight(grid, x, y)` → number
   - `getWalkingHeight(grid, x, y, items)` → number (tile height + stacked items)
   - `gridToScreen(x, y)` → {screenX, screenY} (fórmula isométrica)
   - `screenToGrid(screenX, screenY)` → {gridX, gridY}
2. Types:
   ```typescript
   type TileState = 'open' | 'closed';
   interface RoomTile { x: number; y: number; height: number; state: TileState; }
   type RoomGrid = RoomTile[][];
   ```
3. Tests:
   - Parse heightmap simple "000|000|000" → 3×3 grid, all height 0
   - Parse with heights "012|345|678" → correct heights
   - Parse with closed tiles "00x|0x0|x00"
   - isValidTile on boundaries and closed tiles
   - gridToScreen/screenToGrid roundtrip

**Criterios de aceptación:**
- [ ] Heightmap parsing matches Havana format
- [ ] All tile operations correct
- [ ] Coordinate transforms roundtrip accurately
- [ ] 5+ tests passing

**Dependencias:** T-001

---

### T-022: Pathfinder A*
**Descripción:** A* pathfinding con 8 direcciones y height constraints.  
**Ref:** FASE-1 deep dive (Havana Pathfinder.java)  
**Acciones:**
1. `src/services/pathfinder.ts`:
   - `findPath(grid, items, start, end)` → `Position[]` | null
   - A* con 8 directions (N, NE, E, SE, S, SW, W, NW)
   - `isValidStep(grid, items, from, to, isFinalStep)`:
     - Target tile must be open and within bounds
     - Height difference: lift ≤ 1.5, drop ≤ 3.0
     - Diagonal: both adjacent orthogonal tiles must be walkable
     - Target tile must not have non-walkable item (unless isFinalStep and item canSit)
   - Heuristic: octile distance (diagonal-aware)
   - Max iterations limit (1000) to prevent infinite loops
2. Types:
   ```typescript
   interface Position { x: number; y: number; }
   interface PathNode { pos: Position; g: number; h: number; f: number; parent?: PathNode; }
   ```
3. Tests:
   - Straight path on flat grid
   - Path around obstacle
   - Path with height changes (within limits)
   - No path when blocked
   - No path when height difference too large
   - Diagonal movement blocked by adjacent walls
   - Path to chair (canSit on final step)
   - Max iterations prevents hang

**Criterios de aceptación:**
- [ ] A* finds optimal paths
- [ ] Height constraints match Havana (1.5 lift, 3.0 drop)
- [ ] Diagonal blocking works
- [ ] Max iteration safety
- [ ] 8+ tests passing

**Dependencias:** T-021

---

### T-023: Furniture Service
**Descripción:** Colocación, movimiento y remoción de muebles con collision detection.  
**Ref:** Sequence Diagram §6, FASE-1 deep dive  
**Acciones:**
1. `src/services/furniture.ts`:
   - `placeFurniture(roomId, itemDefId, x, y, rotation, placedBy)` → item
     - Load item definition from catalog
     - Calculate affected tiles based on rotation + dimensions
     - Check collision (all affected tiles must be free or stackable)
     - Calculate z (stack height at position)
     - Insert item + regenerate collision map
   - `moveFurniture(roomId, itemId, newX, newY, newRotation)` → item
   - `removeFurniture(roomId, itemId)` → success
   - `getAffectedTiles(itemDef, x, y, rotation)` → Position[]
   - `getItemsInRoom(roomId)` → items[]
2. `src/data/furniture-catalog.ts`:
   ```typescript
   const CATALOG = {
     chair_wood: { width: 1, depth: 1, height: 1.0, canSit: true, walkable: false },
     table_round: { width: 2, depth: 2, height: 0.8, canSit: false, walkable: false },
     lamp_floor: { width: 1, depth: 1, height: 1.5, canSit: false, walkable: false },
     plant_pot: { width: 1, depth: 1, height: 0.5, canSit: false, walkable: false },
     bookshelf: { width: 2, depth: 1, height: 2.0, canSit: false, walkable: false },
     sofa_2seat: { width: 2, depth: 1, height: 0.8, canSit: true, walkable: false },
     rug_small: { width: 2, depth: 2, height: 0.01, canSit: false, walkable: true },
     tv_screen: { width: 2, depth: 1, height: 1.2, canSit: false, walkable: false },
     desk_office: { width: 2, depth: 1, height: 0.8, canSit: false, walkable: false },
     bed_single: { width: 1, depth: 2, height: 0.6, canSit: true, walkable: false },
   } as const;
   ```
3. Tests:
   - Place on empty tile → success
   - Place on occupied tile → error
   - Place multi-tile item → all affected tiles marked
   - Stack item on top of another → correct z
   - Remove item → collision map updated
   - Move item → old tiles freed, new tiles occupied
   - Rotation changes affected tiles correctly

**Criterios de aceptación:**
- [ ] 10 item definitions in catalog
- [ ] Placement with collision detection
- [ ] Stacking with correct z calculation
- [ ] Rotation affects tile calculation
- [ ] 7+ tests passing

**Dependencias:** T-021, T-011

---

## Sprint 3 — WebSocket + Chat + Moderation

### T-030: WebSocket Protocol + Handler
**Descripción:** WebSocket server con autenticación, routing, y heartbeat.  
**Ref:** TRD sección 6.5, ADR-005  
**Acciones:**
1. `src/ws/protocol.ts`:
   - Define all message types with zod schemas (client→server and server→client)
   - Types: room.join, room.leave, message.send, agent.move, furniture.place/move/remove, ping/pong
2. `src/ws/handler.ts`:
   - WebSocket upgrade on Express server with JWT validation from query param
   - Connection pool: `Map<string, WebSocket>` (agentId → ws)
   - Room membership: `Map<string, Set<string>>` (roomId → Set<agentId>)
   - Message routing: parse → validate → route to service → broadcast response
   - Heartbeat: server sends ping every 30s, client must pong within 10s, else disconnect
   - Graceful disconnect: leave room, cleanup presence
3. Tests:
   - Connect with valid JWT → connected event
   - Connect without JWT → rejected
   - Connect with expired JWT → rejected
   - Heartbeat timeout → disconnected
   - Message with invalid schema → error

**Criterios de aceptación:**
- [ ] WS upgrade with auth works
- [ ] All message types validated with zod
- [ ] Heartbeat mechanism functional
- [ ] Graceful disconnect cleans up presence
- [ ] 5+ tests passing

**Dependencias:** T-012, T-020

---

### T-031: Chat Service + Message Signing
**Descripción:** Chat en tiempo real con firma Ed25519 por mensaje.  
**Ref:** TRD sección 6.5, Sequence Diagram §5  
**Acciones:**
1. `src/services/chat.ts`:
   - `sendMessage(agentId, roomId, content, signature)`:
     - Verify Ed25519 signature of `SHA-256(roomId + content + timestamp)`
     - Check rate limit (10 msgs / 10s)
     - Run content filter
     - Persist to DB (async, non-blocking)
     - Return message for broadcast
   - Content filter: configurable blocklist, max length 2000 chars, URL detection
2. Integration with WS handler: message.send → chat.sendMessage → broadcast message.new
3. Tests:
   - Send with valid signature → broadcast to room
   - Send with invalid signature → rejected
   - Send over rate limit → RATE_LIMITED error
   - Send with blocked content → filtered
   - Send over max length → rejected
   - Message persisted in DB

**Criterios de aceptación:**
- [ ] Signature verification on every message
- [ ] Rate limiting functional
- [ ] Content filter catches blocklist items
- [ ] Messages persisted for audit
- [ ] 6+ tests passing

**Dependencias:** T-010, T-030, T-020

---

### T-032: Rate Limiting (Redis Sliding Window)
**Descripción:** Rate limiting per-agent con sliding window en Redis.  
**Ref:** TRD sección 6.6  
**Acciones:**
1. `src/utils/rate-limit.ts`:
   - `checkRateLimit(agentId, action, limit, windowMs)` → {allowed: boolean, retryAfterMs?: number}
   - Implementation: Redis MULTI/EXEC with ZRANGEBYSCORE + ZADD + EXPIRE
   - Sliding window: count actions in [now - windowMs, now]
2. Configure limits per TRD:
   - messages: 10 / 10s
   - room_join: 5 / 60s
   - room_create: 3 / 3600s
   - auth_challenge: 10 / 300s
   - ws_connections: 3 simultaneous
3. Tests:
   - Under limit → allowed
   - At limit → blocked with retryAfterMs
   - After window passes → allowed again
   - Different actions have independent limits

**Criterios de aceptación:**
- [ ] Sliding window implementation (not fixed)
- [ ] All 5 action types configured
- [ ] Atomic Redis operations (no race conditions)
- [ ] 4+ tests passing

**Dependencias:** T-002, T-001

---

### T-033: Moderation Service
**Descripción:** Mute, ban, report, content filtering.  
**Ref:** Plan sección 10  
**Acciones:**
1. `src/services/moderation.ts`:
   - `muteAgent(agentId, roomId?, durationSecs, reason, mutedBy?)` → mute record
   - `banAgent(agentId, roomId?, reason, expiresAt?, bannedBy?)` → ban record
   - `unbanAgent(agentId, roomId?)` → success
   - `isMuted(agentId, roomId?)` → boolean
   - `isBanned(agentId, roomId?)` → boolean
   - `reportAgent(reporterId, targetId, reason)` → report (threshold: 3 reports → auto-mute)
   - Auto-mute on rate limit violation (30s)
2. All moderation actions → audit_log
3. Tests:
   - Mute → agent can't send messages → unmute after duration
   - Ban → agent can't connect
   - Room-specific ban vs global ban
   - Report threshold → auto-mute
   - All actions logged

**Criterios de aceptación:**
- [ ] Mute/ban/report functional
- [ ] Auto-mute on rate limit
- [ ] Report threshold system
- [ ] Complete audit logging
- [ ] 5+ tests passing

**Dependencias:** T-011, T-032

---

## Sprint 4 — Client + Visual

### T-040: Cliente Web — Setup Pixi.js + Vite
**Descripción:** Proyecto del cliente isométrico.  
**Ref:** ADR-002  
**Acciones:**
1. `client/` directory:
   - Vite + TypeScript
   - Pixi.js v8
   - WebSocket client class
2. `client/src/`:
   - `main.ts` — app entry, init Pixi
   - `ws/client.ts` — WS connection, auth, reconnect
   - `renderer/IsoRenderer.ts` — gridToScreen, screenToGrid, depth sort
   - `renderer/TileMap.ts` — render grid from heightmap
   - `renderer/AgentSprite.ts` — agent sprites with color tinting
   - `renderer/BubbleSystem.ts` — speech bubbles
   - `renderer/FurnitureRenderer.ts` — furniture sprites
3. Placeholder sprites (colored rectangles) until real assets exist

**Criterios de aceptación:**
- [ ] `npm run dev` (in client/) serves Pixi.js app
- [ ] Grid renders from heightmap data
- [ ] Isometric transform correct (2:1 ratio)
- [ ] Click on tile → grid coordinates logged

**Dependencias:** T-030 (needs WS server running)

---

### T-041: Pixel Art Assets — Base Tileset
**Descripción:** Crear los sprites base del mundo isométrico.  
**Ref:** Plan sección 9.1-9.2  
**Acciones:**
1. Floor tiles (64×32px, estilo Habbo):
   - Stone, wood, grass, carpet, sand, water (6 tiles)
   - Rules: black outlines, flat colors, dithering for texture, top-left lighting
2. Wall tiles (4 variantes)
3. Door tile
4. Agent sprite:
   - Greyscale base (colorized by code)
   - 4 rotations (0, 2, 4, 6)
   - 2 states: idle (1 frame), walking (2 frames)
5. 10 furniture sprites (from catalog):
   - Each in at least 2 rotations (0, 2)
   - Following style guide strictly
6. Speech bubble sprite
7. All assets in `client/assets/sprites/`

**Criterios de aceptación:**
- [ ] 6 floor tiles, 4 wall tiles, 1 door
- [ ] Agent sprite: 4 rotations × 2 states (greyscale base)
- [ ] 10 furniture items: at least 2 rotations each
- [ ] All follow style guide (outlines, flat colors, top-left lighting, 64×32 base)
- [ ] Speech bubble sprite

**Dependencias:** Ninguna (puede ejecutarse en paralelo)
**Nota:** Este ticket puede requerir generación AI + retoque manual o comisión de pixel artist.

---

### T-042: Client Integration — Full Room View
**Descripción:** Conectar el cliente al servidor y renderizar una sala completa.  
**Acciones:**
1. Auth flow en cliente: register/login → get JWT → WS connect
2. Room list → select → join → receive room state
3. Render: grid + agents + furniture + speech bubbles
4. Interactions:
   - Click empty tile → send agent.move → animate path
   - See other agents move in real-time
   - See chat messages as speech bubbles
5. Basic UI: room name, occupant count, chat input

**Criterios de aceptación:**
- [ ] Full auth flow works in browser
- [ ] Room renders with tiles, agents, furniture
- [ ] Real-time movement and chat visible
- [ ] Multiple browser tabs = multiple agents interacting

**Dependencias:** T-040, T-041, T-030, T-031

---

## Sprint 5 — Polish + Deploy

### T-050: Observability — Logging + Health Check
**Acciones:**
1. Pino structured logging in all services
2. `GET /health` endpoint (DB + Redis connectivity check)
3. Basic metrics: connected agents, active rooms, messages/sec (in-memory counters, exposed via `/metrics`)

**Criterios de aceptación:**
- [ ] All services log with Pino (JSON structured)
- [ ] Health endpoint returns 200 when healthy, 503 when not
- [ ] Metrics endpoint returns basic counters

**Dependencias:** T-030

---

### T-051: Admin Dashboard
**Acciones:**
1. Simple HTML + htmx page at `/admin` (auth required, spectator with is_admin=true)
2. Views: room list + occupants, agent list + status, audit log viewer
3. Actions: ban, mute, delete room

**Criterios de aceptación:**
- [ ] Dashboard loads with auth
- [ ] Can view rooms, agents, audit log
- [ ] Can ban/mute agents from UI

**Dependencias:** T-033, T-020

---

### T-052: Stress Testing + Security Validation
**Acciones:**
1. Script: simulate 50 agents connecting, joining rooms, chatting
2. Verify: rate limiting under load, no crashes after 10 min
3. Security: attempt auth without sig, SQL injection via content, WS flood, mass registration
4. Measure: messages/sec throughput, latency p50/p95/p99

**Criterios de aceptación:**
- [ ] 50 concurrent agents stable for 10 minutes
- [ ] All security attack vectors rejected
- [ ] Throughput > 1,000 msg/s
- [ ] p99 latency < 100ms

**Dependencias:** All previous tickets

---

### T-053: Documentation + README
**Acciones:**
1. README.md: project description, setup, architecture overview, API reference
2. Agent Client Example: minimal script showing register → login → join → chat
3. Spectator Guide: how to observe rooms

**Criterios de aceptación:**
- [ ] New developer can setup project from README in <10 minutes
- [ ] Agent example script works end-to-end

**Dependencias:** All previous tickets

---

## Resumen

| Sprint | Tickets | Estimación | Descripción |
|--------|---------|-----------|-------------|
| 0 | T-000, T-001, T-002 | 1-2 días | Foundation |
| 1 | T-010, T-011, T-012 | 3-4 días | Auth + Identity |
| 2 | T-020, T-021, T-022, T-023 | 4-5 días | Rooms + Grid + Pathfinding |
| 3 | T-030, T-031, T-032, T-033 | 4-5 días | WebSocket + Chat + Moderation |
| 4 | T-040, T-041, T-042 | 5-7 días | Client + Visual |
| 5 | T-050, T-051, T-052, T-053 | 3-4 días | Polish + Deploy |
| **Total** | **17 tickets** | **~20-27 días** | **MVP completo** |

---

*Cada ticket es ejecutable por un coding agent (Codex CLI o Claude Code) con contexto mínimo.*
*Prioridad: Sprint 0 → 1 → 2 → 3 → 4 → 5, sin saltar.*
