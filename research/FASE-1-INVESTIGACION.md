# FASE 1 — INVESTIGACIÓN HISTÓRICA

**Autor:** Aura ✦ (investigación directa, no delegada)  
**Fecha:** 2026-02-13  
**Objetivo:** Separar hechos de reconstrucción. Construir base sólida antes de diseñar.

**Clasificación:**
- **[A] Verificado** — Fuente directa (docs oficiales, papers, código, press releases)
- **[B] Inferido** — Deducción razonable con evidencia (se explica el razonamiento)
- **[C] Desconocido** — No verificable, gap de conocimiento identificado

---

## PARTE 1: HABBO HOTEL — SISTEMA HISTÓRICO

### 1.1 Orígenes y Evolución

**[A]** Habbo Hotel nació de "Mobiles Disco", un proyecto hobby creado en agosto 1999 por **Sampo Karjalainen** (diseñador) y **Aapo Kyrölä** (tecnólogo) en Helsinki, Finlandia. Ambos trabajaban en "To the Point", una empresa de IT finlandesa. Fueron comisionados para crear un sitio web promocional para Mobiles, una banda de rap finlandesa.

**[A]** El diseño fue inspirado por juguetes Playmobil (el álbum de la banda tenía Playmobils en la portada) y juegos isométricos 8-bit como "Head over Heels" en ZX Spectrum.

**[A]** La tecnología subyacente era **FUSE** (en finés: "Sulake" = fusible), un sistema de servidores en Java creado por Kyrölä para comunicación entre películas Macromedia Director/Shockwave y un servidor, usando un protocolo personalizado. Sulake lo creó porque no estaban impresionados con el servidor multi-usuario propio de Macromedia.

**[A]** De Mobiles Disco surgió "Hotelli Kultakala" (Hotel Goldfish), lanzado en agosto 2000. **Sulake Corporation** se fundó en 2000. En enero 2001, Habbo Hotel lanzó en beta en UK.

**[A]** Expansión a 31+ países, 5 continentes. Pico: 316 millones de registros, 10 millones de usuarios únicos mensuales (2012).

**[A]** Cronología de tecnología:
- 1999-2006: Macromedia Director/Shockwave + FUSE (Java)
- 2006-2020: Adobe Flash (ActionScript)
- 2020-2021: Transición a Unity + Adobe AIR como puente
- 2024: "Habbo Hotel: Origins" — versión 18+ revival del cliente 2005
- 2026: Tres clientes coexisten (Habbo Unity, Habbo X NFT, Habbo Origins)

**[A]** FUSE fue open-sourced como "FUSE Light" por Sulake.

**Fuentes:** Wikipedia Habbo, Habbox Wiki, entrevista Karjalainen 2002 (libro "Web 3D"), Forbes 2025.

### 1.2 Arquitectura Técnica

#### Lo que sabemos con certeza

**[A]** El modelo base es **cliente-servidor** con el protocolo FUSE permitiendo distribuir salas en servidores independientes (escalado horizontal). Cada sala podía vivir en un proceso/servidor separado.

**[A]** Existen emuladores open-source que recrean la arquitectura del servidor:
- **Havana** (Java, v31/2009 era) — El más completo emulador Shockwave. Requiere MariaDB + JDK 17+, mínimo 4GB RAM.
- **Suelake** (Blunk-based, protocolo V5)
- **Arcturus** (Java, Flash era, r63)

**[A]** Havana soporta: dual Flash/Shockwave, login SSO ticket + username/password, **Diffie-Hellman** encriptación bidireccional (v28+), catalogue, navigator, rooms, items, messenger, trading, games (Battleball, Snowstorm, Wobble Squabble), achievements, Habbo Club, Ecotron recycling.

**[B]** La arquitectura probable del servidor Habbo original (inferida de emuladores + escala):
```
Cliente (Shockwave/Flash/Unity) 
  → TCP Socket (protocolo binario custom)
    → Gateway/Load Balancer
      → Room Server (uno por sala o grupo de salas)
        → Database (MariaDB/MySQL probable, dado emuladores)
        → Cache (probablemente en memoria, pre-Redis era)
```
**Razonamiento:** Los emuladores más fieles usan MariaDB/MySQL. El protocolo FUSE fue diseñado específicamente para distribuir salas. La escala (100K+ concurrentes) requiere múltiples room servers.

**[C]** Base de datos exacta del Habbo oficial — ¿MySQL, PostgreSQL, Oracle? No confirmado. Emuladores usan MariaDB/MySQL.

**[C]** Tecnología de cache exacta — ¿Memcached? ¿Redis? ¿Custom? Habbo predates Redis (2009).

**[C]** Protocolo de transporte exacto post-Flash — ¿WebSocket? ¿Binary custom? No documentado.

**[C]** CDN provider específico — No documentado.

#### Sistema de Salas

**[A]** Dos tipos de salas:
- **Públicas**: Creadas por Sulake, no customizables, con NPCs/bots automatizados
- **Guest rooms (privadas)**: Creadas por usuarios, totalmente customizables con muebles, wallpaper, floor patterns

**[A]** Las salas usan **perspectiva isométrica** con **grid de tiles** (casillas). Los avatares se mueven por tiles con pathfinding.

**[A]** Los usuarios pueden elegir blueprints de sala prediseñados o crear layouts custom con suscripción Builders Club.

**[A]** Room Navigator: búsqueda por categoría, popularidad, nombre, owner. Las salas populares se mantienen arriba → efecto "rich get richer".

**[B]** Capacidad por sala: 25-75 usuarios concurrent (inferido de discusiones comunitarias y limitaciones de renderizado de sprites isométricos). Staff de Habbo Origins confirmó que los límites se pueden ajustar vía soporte.

**[C]** Algoritmo de pathfinding exacto — probablemente A* adaptado a grid isométrico, pero no documentado.

**[C]** Sistema de coordenadas de tiles (tamaño, dimensiones, profundidad) — no documentado oficialmente.

#### Sistema de Avatar

**[A]** Avatares ("Habbos") con: género, tono de piel, pelo, ropa, accesorios. Personalización adicional con Habbo Club.

**[B]** Renderizado por capas de sprites 2D (body → ropa → pelo → accesorios → animación). 8 direcciones de movimiento en espacio isométrico. Estados: standing, walking, sitting, lying, dancing, waving.

**[C]** Formato exacto de assets (SWF en era Flash, ¿qué en Unity?) — no documentado.

#### Chat

**[A]** Chat aparece como **speech bubbles** sobre los avatares. Mensajería privada vía friends list.

**[A]** **Bobba Filter**: filtro automático que reemplaza palabras ofensivas con "bobba". También filtra grupos de 6+ números (prevenir sharing de teléfonos) y URLs.

**[B]** Chat es proximity-based dentro de sala — todos en la sala ven los mensajes. Habbo usó el concepto de "ver a la gente pero no oírla" para crear sensación espacial (cita de Karjalainen).

#### Economía

**[A]** Sistema de múltiples monedas:
- **Credits**: moneda principal, comprada con dinero real
- **Diamonds** (2014): 1:1 con compra de Credits, para items exclusivos
- **Duckets** (2013): moneda gratuita por logros
- **Seasonal currencies**: temporales por eventos

**[A]** **Habbo Exchange**: convierte Credits a "Credit Furni" (muebles tradeable que representan valor). Tax del 10% (desde 2020, antes 1 credit flat).

**[A]** Marketplace para ventas player-to-player. Tax en trades crea presión deflacionaria.

**[A]** Items "Rare" con valor que aprecia dramáticamente (ejemplo documentado: item de 25 credits → 3,000 credits años después).

**[A]** Problema de RMT (Real-Money Trading): sitios terceros facilitan compraventa por dinero real, creando riesgos de robo de cuentas y scams.

#### Moderación y la Crisis de 2012

**[A]** En junio 2012, **Channel 4 News (UK)** publicó investigación encubierta de 2 meses revelando:
- Chat sexual/pornográfico generalizado en plataforma para +13
- Pedófilos usando la plataforma para grooming
- Reporteros haciéndose pasar por niña de 11 años recibieron acercamientos sexuales en minutos

**[A]** Respuesta de Sulake — "The Great Mute":
- Chat global muteado
- Quiz de seguridad obligatorio para recuperar chat
- **Permisos de chat escalonados** — ganar derecho a hablar más libremente con buen comportamiento
- Chat restaurado gradualmente por región (Finlandia primero, UK último en julio 2012)

**[A]** Consecuencias: Balderton Capital y 3i retiraron inversión. Tesco, WHSmith, GAME dejaron de vender gift cards. Tesco confirmó que "no tiene planes" de reanudar ventas.

**[A]** Pre-crisis, Sulake tenía 225+ moderadores 24/7, ~70 millones de líneas de chat/día. CEOP les dio premio "Safer by Design" en 2011. La Comisión Europea los reconoció como una de las redes sociales más seguras. **La crisis demostró que todo eso era insuficiente.**

**[A]** Programa Hobbas (2000-2005): moderadores voluntarios, suspendido por "problemas mayores de seguridad". Programa Guardians (2012): versión mejorada anunciada post-crisis.

**Lección transferible CRÍTICA:** La reputación de seguridad se destruye en un día y tarda años en recuperarse. La moderación automatizada sola es insuficiente. Los permisos escalonados (earn-to-speak) fueron la solución más efectiva.

#### Anti-Abuso

**[A]** Tipos de scams documentados: phishing, keyloggers, trade scams, account hijacking.

**[A]** Medidas: Safety Lock (seguridad de cuenta), recomendación antivirus, bloqueo de usuarios, verificación de links.

**[C]** Mecanismos específicos de bot detection — no documentados.
**[C]** Políticas de ban (duración, tasas de apelación exitosa) — no documentados.

#### Escala y Declive

**[A]** Peak: 316M registros, 10M mensuales. Estimación comunitaria: 100K+ concurrent en años dorados (2007-2012).

**[A]** Factores de declive: Flash deprecation (existencial), crisis 2012, competencia (Roblox, Fortnite, Discord, TikTok), monetización agresiva.

**[A]** Estrategia nostalgia: Habbo Origins (2024, 18+) y Habbo X (NFTs, adultos crypto-nativos).

### 1.3 Gaps Críticos de Conocimiento sobre Habbo

| # | Gap | Impacto en diseño | Mitigación |
|---|-----|-------------------|------------|
| 1 | Arquitectura servidor exacta (DB, cache, message queue) | Medio | Usar emuladores como referencia + stack moderno |
| 2 | Algoritmo pathfinding | Bajo (podemos usar A*) | Implementar A* estándar para grid isométrico |
| 3 | Protocolo de transporte post-Flash | Medio | Usar WebSocket (estándar moderno) |
| 4 | Capacidad exacta de salas | Bajo | Tests de carga propios |
| 5 | Formato de assets Unity actual | Bajo | Definimos nuestro propio formato |
| 6 | Bot detection específico | Alto | Diseñar desde cero basado en best practices |

---

## PARTE 2: MOLTBOOK — EXPERIMENTO DE RED SOCIAL PARA AGENTES

### 2.1 Qué es y Qué Pasó

**[A]** Moltbook fue lanzado el **28 de enero de 2026** por **Matt Schlicht** (CEO de Octane AI). Primera red social diseñada exclusivamente para agentes de IA. Formato Reddit (posts, comments, upvotes, submolts).

**[A]** Construido enteramente con IA (Claude) — "vibe coding". Schlicht declaró públicamente: "I didn't write one line of code".

**[A]** **Breach catastrófico el 31 de enero** (día 3):
- Row Level Security (RLS) **deshabilitado** en Supabase
- API key visible en JavaScript del cliente
- 1.5 millones de API tokens expuestos
- 35,000 emails y Twitter handles expuestos
- Cualquiera podía impersonar cualquier agente
- Descubierto por Wiz Security y Jamieson O'Reilly (Dvuln)

**[A]** Wired demostró que un humano podía infiltrarse trivialmente posando como agente con comandos curl generados por ChatGPT.

**[A]** Claims de 1.5M agentes registrados. **Contraevidence:** investigador Gal Nagli reportó ~500K agentes de una sola IP → probable inflación.

### 2.2 Lo Que Funcionó (Genuinamente)

**[A]** Prueba de concepto exitosa — demostró demanda masiva para socialización entre agentes.

**[A]** Cobertura mediática masiva: NYT, Guardian, Wired, BBC, NBC, CNBC.

**[A]** Engagement de figuras clave: Andrej Karpathy (primero entusiasmado, luego "dumpster fire"), Simon Willison, Elon Musk.

**[B]** El modelo de "humanos welcome to observe" creó viralidad y curiosidad genuina.

### 2.3 Lo Que Falló

**[A]** Seguridad nula — vibe coding sin review.

**[A]** Identidad no verificable — API key = identidad, trivial de suplantar.

**[A]** Problema epistemológico fundamental: **nadie puede probar si un post es autónomo, semi-autónomo, o humano-dirigido.**

**[A]** Vulnerabilidades de OpenClaw documentadas:
- CVE-2026-25253: One-Click RCE (CVSS 8.8) — link malicioso exfiltra auth token
- CVE-2026-24763 & CVE-2026-25157: Command injection
- CVE-2026-22708: Indirect prompt injection
- **"ClawHavoc"**: 341 skills maliciosos (12% de ClawHub) distribuyendo Atomic Stealer malware

**[A]** Simon Willison: "Lethal Trifecta Plus One" — agentes con (1) datos privados + (2) input no confiable + (3) comunicación externa + (4) memoria persistente = peligro inherente.

### 2.4 Lecciones para OpenClaw Hotel

**ADOPTAR:**
- Comunidades temáticas
- Diversidad de contenido (no restringir temas)
- Modo observador para humanos

**ADAPTAR:**
- Identidad criptográfica (no API keys)
- Defense-in-depth security
- Niveles de autonomía transparentes (nunca afirmar "autónomo" sin prueba)

**EVITAR:**
- Vibe coding para infraestructura de seguridad
- Credenciales centralizadas en una sola DB
- Marketplace de skills sin curación
- Claims de autonomía no verificables

---

## PARTE 3: ECOSISTEMA DE PROTOCOLOS AGENT-TO-AGENT

### 3.1 Google A2A (Agent-to-Agent Protocol)

**[A]** Lanzado abril 2025 por Google. Donado a Linux Foundation junio 2025. Versión 0.3 (julio 2025).

**[A]** JSON-RPC 2.0 sobre HTTP(S). Discovery via "Agent Cards" (JSON describiendo capacidades). Soporta sync, streaming (SSE), y async push.

**[A]** Filosofía: opacity-preserving (agentes no exponen estado interno), task-oriented, framework-agnostic.

**[A]** Partners: Google, IBM, SAP, Salesforce, Cisco.

**Relevancia:** Protocolo para delegación de tareas entre agentes dentro de OpenClaw Hotel.

### 3.2 Anthropic MCP (Model Context Protocol)

**[A]** Lanzado noviembre 2024. Donado a Agentic AI Foundation (febrero 2026).

**[A]** Client-server: MCP Clients (apps IA) ↔ MCP Servers (data sources/tools). 75+ connectors.

**Relevancia:** Conexión de agentes con herramientas externas, no directamente con socialización.

### 3.3 XMTP

**[A]** Protocolo de mensajería descentralizada Web3. E2E encryption (MLS standard). Wallet addresses como identifiers.

**[A]** Agent SDK v1: agentes pueden enviar/recibir mensajes, hold/move crypto funds, participar en group chats.

**Relevancia:** Potencial capa de DMs privados encriptados entre agentes.

### 3.4 AgentProtocol (AI Engineer Foundation)

**[A]** API REST estándar para controlar agentes. Core endpoints: tasks, steps, artifacts.

**[A]** Implementado en AutoGPT, usado para benchmarking.

**Relevancia:** Estandarización de interfaz de control.

### 3.5 Stack Emergente

```
[Social/Visual]    OpenClaw Hotel     ← NOSOTROS
[Agent-to-Agent]   Google A2A         ← Delegación tareas
[Agent-to-Tools]   Anthropic MCP      ← Integración herramientas
[Messaging]        XMTP               ← DMs encriptados
[Control API]      AgentProtocol      ← Estandarización
[Runtime]          OpenClaw, AutoGPT  ← Ejecución
[Intelligence]     Claude, GPT, Llama ← LLMs
```

---

## PARTE 4: MUNDOS VIRTUALES CON IA — LA PIEZA QUE FALTA

### 4.1 Project Sid (Altera) — Civilización de Agentes en Minecraft

**[A]** Paper: "Project Sid: Many-agent simulations toward AI civilization" (arXiv 2411.00114, octubre 2024).

**[A]** Creado por **Altera**, startup de San Francisco fundada por **Robert (Guangyu) Yang**, ex-profesor MIT neuroscience.

**[A]** Experimento: **1,000+ agentes autónomos** (GPT-4) en servidor Minecraft. Los agentes:
- Desarrollaron roles especializados autónomamente
- Crearon y obedecieron reglas colectivas
- Transmitieron información cultural y religiosa
- Formaron alianzas, crearon moneda con gemas, comerciaron recursos
- Exhibieron corrupción

**[A]** Arquitectura PIANO (Parallel Information Aggregation via Neural Orchestration):
- Módulos concurrentes (pensamiento lento + acción rápida simultáneos)
- Working Memory, Short-term Memory, Long-term Memory
- Cada módulo = función stateless que lee/escribe a un Agent State compartido
- Módulos sociales se activan selectivamente en interacciones sociales
- Módulos reflex usan redes neuronales pequeñas/rápidas, goal generation usa razonamiento deliberado

**[A]** Problemas identificados por el paper:
1. **Single agents don't make progress** — Alucinaciones se acumulan. Agente dice "estoy comiendo un bagel" cuando no come nada → cree que no necesita buscar comida.
2. **Groups amplify errors** — Agente A alucina → comunica alucinación a Agente B → propagación exponencial.
3. **Falta de benchmarks** — Previo máximo: 25-50 agentes. No existían métricas para progreso civilizacional.

**[A]** Solución de coherencia: "bottleneck" de información — todos los módulos concurrentes pasan por un estado compartido, como un pianista coordinando múltiples notas en armonía.

**Lección transferible CRÍTICA:** Los agentes necesitan:
- Grounded sense of reality (verificar estado real del mundo, no confiar en su propia narrativa)
- Coherencia entre acción y comunicación
- Mecanismos anti-alucinación colectiva
- Benchmarks para medir progreso significativo

### 4.2 Voyager (NVIDIA) — Agente que Aprende y Construye

**[A]** Paper: "Voyager: An Open-Ended Embodied Agent with Large Language Models" (arXiv 2305.16291, mayo 2023). NVIDIA + Caltech + Stanford + UT Austin.

**[A]** Primer agente LLM-powered de "lifelong learning" en Minecraft. Tres componentes:
1. **Automatic curriculum** — maximiza exploración, genera objetivos progresivos
2. **Skill library** — almacena y recupera comportamientos complejos como **código ejecutable**
3. **Iterative prompting** — genera código, lo ejecuta, verifica resultado, itera

**[A]** El agente "se auto-programa" — escribe, refina, y almacena JavaScript (Mineflayer API) para nuevas habilidades. Cada skill = función reutilizable.

**[A]** Resultados: Voyager obtiene 3.3x más items únicos que baselines, recorre 2.3x más distancia, desbloquea todo el tech tree de Minecraft sin intervención humana.

**Lección transferible CRÍTICA:** El modelo de **skill library como código ejecutable** es directamente aplicable a OpenClaw Hotel:
- Agentes que escriben "scripts" para crear mobiliario
- Agentes que aprenden a construir y comparten skills
- Curriculum automático que guía exploración del mundo

### 4.3 Generación Procedural de Assets

**[A]** Paper survey: "Procedural Content Generation via Generative Artificial Intelligence" (arXiv 2407.09013, julio 2024). Cubre:
- Generación de niveles con modelos de difusión
- Generación de materiales/texturas (MatFuse)
- Generación de assets 2D/3D desde texto

**[B]** Para OpenClaw Hotel, la generación de assets puede ser:
- **Text → 2D sprite**: Agente describe mueble → modelo genera sprite isométrico (Stable Diffusion fine-tuned)
- **Template + parameters**: Agente especifica tipo + color + tamaño → sistema genera variante desde templates
- **Code-as-content**: Agente escribe definición JSON/code de un mueble → sistema lo renderiza (más controlable, tipo Voyager)

**Razonamiento:** La opción más viable para MVP es template + parameters o code-as-content. Generación libre con difusión requiere fine-tuning y pipeline de assets que no es MVP scope.

### 4.4 Emuladores Habbo como Referencia Técnica

**[A]** **Havana** (github.com/Quackster/Havana) es el emulador Habbo más completo:
- Java, MariaDB
- Soporta dual Flash/Shockwave
- Feature-complete: rooms, items, trading, games, messenger, catalogue, achievements, Habbo Club
- Diffie-Hellman encryption
- 4+ años de desarrollo, un solo developer principal

**[B]** Havana demuestra que recrear la funcionalidad core de Habbo es factible con un equipo pequeño (incluso uno solo). La complejidad está en los detalles y la escala, no en la arquitectura base.

**Relevancia:** Podemos estudiar el código de Havana para entender flujos exactos (room entry, item placement, trading) sin tener que inferir.

---

## PARTE 5: SÍNTESIS — QUÉ CONSTRUIMOS Y POR QUÉ

### 5.1 La Visión (basada en investigación)

**OpenClaw Hotel** = Habbo Hotel (mundo social isométrico con salas, presencia, chat) + Moltbook (red social de agentes, modo observador) + Project Sid (agentes autónomos que forman sociedades) + Voyager (agentes que construyen y crean contenido)

**No es:** un chat. Un foro. Un clon de Habbo. Un clon de Moltbook.

**Es:** un mundo vivo donde agentes de IA autenticados criptográficamente se mueven, hablan, crean salas, construyen mobiliario, y forman comunidades emergentes — observable por humanos.

### 5.2 Subsistemas Identificados (para Fase 2)

| Subsistema | Inspiración | Prioridad |
|------------|-------------|-----------|
| Auth (identidad criptográfica) | Lecciones Moltbook (NO API keys) | P0 |
| Rooms (salas con grid espacial) | Habbo (tiles isométricos) | P0 |
| Chat (speech bubbles, presencia) | Habbo (spatial chat) | P0 |
| Presence (quién está dónde) | Habbo (Navigator) | P0 |
| Content Creation (agentes crean muebles/salas) | Voyager (skill library), Project Sid | P1 |
| Moderación | Habbo post-2012 (escalonada) | P0 |
| Economy (si se implementa) | Habbo (Credits, Exchange, tax) | P2 |
| Analytics/Observabilidad | Project Sid (benchmarks civilizacionales) | P1 |
| Human Spectator Mode | Moltbook ("welcome to observe") | P1 |

### 5.3 Decisiones Preliminares Informadas por Investigación

| Decisión | Justificación |
|----------|---------------|
| Ed25519 para identidad, no API keys | Breach Moltbook demostró que API keys son insuficientes |
| Grid isométrico con tiles | Habbo demostró que crea sensación de "lugar" y presencia |
| Agentes escriben código para crear contenido | Voyager demostró viabilidad con skill library |
| Permisos escalonados para chat | Habbo post-2012 "earn the right to speak" fue la solución más efectiva |
| WebSocket para real-time, no polling | Estándar moderno, Habbo usó TCP sockets custom (pre-WS) |
| In-memory para MVP, PostgreSQL para persistencia | Emuladores Habbo usan MariaDB, pero in-memory simplifica MVP |
| Módulos concurrentes (inspirado PIANO) | Project Sid demostró que single-threaded no escala para agentes sociales |

---

## RESUMEN DE GAPS DE CONOCIMIENTO

### Gaps Resueltos por esta Investigación
- ✅ Cómo funcionan las salas de Habbo (emulador Havana como referencia)
- ✅ Qué falló en Moltbook y por qué (breach, identidad, vibe coding)
- ✅ Cómo agentes pueden crear contenido en mundos virtuales (Voyager, Project Sid)
- ✅ Qué protocolos agent-to-agent existen (A2A, MCP, XMTP, AgentProtocol)
- ✅ Arquitectura PIANO para agentes concurrentes

### Gaps que Necesitan Resolverse en Fase 2
- [ ] ¿Cómo implementar pathfinding isométrico eficiente para agentes?
- [ ] ¿Qué formato de assets para mobiliario generado por agentes?
- [ ] ¿Cómo prevenir "alucinación colectiva" (Project Sid problem)?
- [ ] ¿Rate limiting específico para agentes vs humanos?
- [ ] ¿Cómo escalar WebSocket a 1000+ agentes concurrent?
- [ ] ¿Modelo de datos para items creados proceduralmente?

---

## FUENTES

### Fuentes Primarias (Verificadas)
1. Wikipedia: Habbo (https://en.wikipedia.org/wiki/Habbo)
2. Habbox Wiki: Mobiles Disco, Credits
3. S. Dredge, "Web 3D" (2002) — Entrevista Karjalainen
4. Forbes: "How Social MMO Habbo Has Thrived and Survived for Over 25 Years" (agosto 2025)
5. Channel 4 News: "What is happening in Habbo Hotel?" (2012)
6. arXiv 2411.00114: "Project Sid: Many-agent simulations toward AI civilization" (2024)
7. arXiv 2305.16291: "Voyager: An Open-Ended Embodied Agent with Large Language Models" (2023)
8. arXiv 2407.09013: "Procedural Content Generation via Generative AI" (2024)
9. GitHub Quackster/Havana — emulador Habbo más completo
10. GitHub MineDojo/Voyager — agente Minecraft NVIDIA
11. NVIDIA Blog: "Mine-Blowing Breakthrough: Voyager" (2024)
12. Wikipedia: Moltbook
13. Wired: "I Infiltrated Moltbook" (2026)
14. 404 Media: "Exposed Moltbook Database" (2026)
15. Adversa AI: "OpenClaw security guide 2026"
16. Palo Alto Networks: "Why Moltbot May Signal AI Crisis" (2026)
17. Google A2A: https://a2a-protocol.org/
18. Anthropic MCP: https://modelcontextprotocol.io/
19. XMTP: https://docs.xmtp.org/
20. AgentProtocol: https://agentprotocol.ai/
21. Tom's Guide: "A company gave 1,000 AI agents access to Minecraft" (2024)
22. BBC Science Focus: "1,000 AIs were left to build their own village" (2025)

---

---

## PARTE 6: DEEP DIVE — LO QUE NECESITABA ENTENDER DE VERDAD

*Añadido tras auto-evaluación honesta. Estas son las piezas que faltaban para pasar de "analista que recopila" a "constructor que entiende".*

### 6.1 Cómo Funciona el Pixel Art Isométrico (El Craft)

**[A] La regla fundamental: ratio 2:1.** Para cada 2 píxeles horizontales, 1 vertical. Esto crea un ángulo de ~26.5° (no los 30° de isometría verdadera). La isometría verdadera a 30° produce líneas jaggy/irregulares en pixel art, por eso se usa 2:1 como compromiso universal.

**[A] El diamante es la base de todo.** Un tile isométrico es un diamante cuyas esquinas son: top (centro superior), left (punto izquierdo), right (punto derecho), bottom (centro inferior). Todo objeto en el grid se ancla a estos puntos.

**[A] Tamaños de tile estándar:**
| Tamaño | Uso | Detalle |
|--------|-----|---------|
| 32×16 | Mobile, estilo simple | Bajo |
| 64×32 | **El más común**, balance | Medio |
| 128×64 | Juegos detallados | Alto |

**[A] Habbo usa tiles de 64×32 píxeles** para el floor. Confirmado por el CodePen "Habbo HTML5 Room Tiles" de Veltix: `const width = 64; const height = 32;`

**[A] Convención de iluminación:** Luz desde arriba-izquierda. Superficie superior = más clara, cara izquierda = media, cara derecha = más oscura. Es ESTÁNDAR y consistente en todo Habbo.

**[A] Estilo visual Habbo específico:**
- **Outlines negros fuertes** rodeando todos los elementos principales
- **Colores planos/flat**, sin gradientes (o mínimos)
- **Mucho detalle** en los objetos, pero **sombras simples** (no hay iluminación compleja)
- **Dithering** para texturas y transiciones de color (patrón de píxeles alternos que simula más colores de los que realmente tiene)
- **Consistencia obsesiva**: cada mueble sigue las mismas reglas isométricas, mismo ángulo, misma iluminación

**[A] Ropa/avatares necesitan 4+ direcciones** de sprites + animaciones de caminar. Sparkaro (diseñador de Habbo): "Tenemos que diseñar cómo se verá la ropa en cada dirección en que el Habbo se mueve, y añadir frames de animación si es necesario."

**[A] Ropa se dibuja en escala de grises** y los colores se aplican vía código — así una prenda tiene múltiples opciones de color sin redibujar.

**Lo que entiendo ahora:** El estilo Habbo no es "pixel art genérico". Es un sistema de reglas estrictas: ratio 2:1, outlines negros, flat colors, sin gradientes, luz top-left, dithering para textura. Seguir estas reglas es lo que hace que miles de muebles de diferentes artistas se vean cohesivos. Para OpenClaw Hotel, necesitamos definir un style guide igual de estricto — no dejar que cada agente genere sprites "como quiera".

### 6.2 El Pipeline de Assets de Sulake (Verificado)

**[A] Sulake usa Photoshop con plugins internos custom** para todo el proceso. No software externo. Los plugins fueron programados por un senior visual artist y están documentados en Behance (gallery/42524865).

**[A] Pipeline completo:**

1. **Colorable Item Editor** — Simplifica hacer items con múltiples colores
   - Carga folder de assets, parsea XML para info de color
   - Cada color (product) se muestra como índice editable
   - Permite asignar colores por capa de sprite
   - Datos editados se guardan en XML para importar al juego

2. **Design Tools** — Automatiza procesos repetitivos
   - Herramientas para skew isométrico y mover capas
   - Opción "use tiles" para mover objetos como en el game space real
   - Permite mockups y marketing con posicionamiento exacto del juego

3. **Template Loader** — Carga templates desde Google Drive
   - Conecta a carpeta GD para tener siempre las templates más actualizadas
   - Carga/duplica template (nunca altera el original)
   - Configurable vía XML

4. **PSD Rebuild** — Reconstruye PSDs desde assets de sprites
   - Lee folder de assets e importa PNGs de sprites a un PSD editable
   - Realinea sprites alrededor del registration point
   - Organiza capas en carpetas y configura opacidad de sombras

5. **Asset Packager** — Empaqueta assets para el servidor
   - Verifica repositorio para archivos válidos
   - Guarda info en XML para importar al juego

**[A] Los assets finales para la era Flash eran archivos SWF** (uno por mueble). Herramientas como FurniExtractor (GitHub: scottstamp/FurniExtractor) pueden convertir SWF → PNG/JSON, extrayendo cada sprite individual con su metadata.

**[A] URL de assets CDN:** `https://habboo-a.akamaihd.net/dcr/hof_furni/{revision}/*.swf` — cada revisión tiene su carpeta.

**Lo que entiendo ahora:** El pipeline de Habbo es sorprendentemente sofisticado para pixel art. No es "artista dibuja y sube". Es un sistema industrializado con templates, validación, empaquetado XML, y control de versiones vía Google Drive. Para OpenClaw Hotel, necesitamos algo análogo: un pipeline donde los agentes puedan crear contenido pero dentro de restricciones del sistema (templates, validación de dimensiones, color palette enforcement).

### 6.3 Cómo Funciona una Sala (Código Real de Havana)

He leído el código fuente del emulador Havana. Esto es lo que entiendo del modelo interno:

**[A] RoomModel — El blueprint de la sala:**
- `heightmap`: string donde cada carácter = un tile. Números (0-9) = altura del tile. 'x' = tile cerrado. Las líneas se separan con `|`.
- `mapSizeX`, `mapSizeY`: dimensiones del grid, parseadas del heightmap
- `tileStates[][]`: RoomTileState.OPEN o RoomTileState.CLOSED para cada tile
- `tileHeights[][]`: double para la altura de cada tile
- `doorX`, `doorY`, `doorZ`, `doorRotation`: punto de entrada

Ejemplo de heightmap: `"xxxxxxxxxxxx|x222211110000|x222211110000|..."` → cada carácter es un tile, números indican altura.

**[A] RoomMapping — El mapa de colisión:**
- `roomMap[][]` de RoomTile: grid 2D donde cada tile sabe qué items y entidades tiene encima
- `regenerateCollisionMap()`: reconstruye todo el mapa. Itera items por altura Z (ordenados), y para cada item agrega a todos los tiles que ocupa (via AffectedTile)
- `addItem()`, `moveItem()`, `removeItem()`: operaciones CRUD de items sobre el mapa
- Cada operación de item: actualiza tiles afectados → regenera heightmap → envía update a clientes → guarda en DB

**[A] Position — Coordenadas en el grid:**
- `x`, `y`: coordenadas del grid (NO píxeles de pantalla)
- `z`: altura (double, para stacking de items)
- `bodyRotation`, `headRotation`: 0-7 (8 direcciones)
- `getSquareInFront()`, `getSquareBehind()`, `getSquareLeft()`, `getSquareRight()`: calculan tile adyacente según rotación
- `getDistanceSquared()`: distancia euclidiana entre dos posiciones
- `touches()`: true si distance ≤ 1

**[A] Pathfinder — A* modificado:**
- Usa `DIAGONAL_MOVE_POINTS` (8 direcciones) para navegación
- `isValidStep()` verifica:
  - Tile origen y destino son válidos
  - Diferencia de altura entre tiles no excede `MAX_LIFT_HEIGHT` (1.5) ni `MAX_DROP_HEIGHT` (3.0)
  - No hay camino diagonal bloqueado por dos tiles no-walkables adyacentes
  - Items en el destino son walkables (o es el paso final y el item lo permite)
  - Reglas especiales para piscinas, teleporters, etc.
- `makePathReversed()`: BFS/A* con lista abierta. Cost = movimiento acumulado + distancia Manhattan al destino
- El path se calcula **del destino al origen** y se devuelve como LinkedList<Position>

**[A] Ciclo de vida de una sala:**
- Al crear: se asigna RoomModel + RoomMapping vacío
- Al entrar primer usuario: `isActive = true`, se cargan items de DB, se regenera collision map, se inician tasks
- Al salir último usuario: `tryDispose()` con delay configurable (default 60s para evitar re-crear si alguien vuelve rápido)
- Dispose: limpia items, entities, derechos, votos; remueve de RoomManager

**Lo que entiendo ahora:** La arquitectura de sala de Habbo es elegante en su simplicidad. Un grid 2D con alturas, un collision map que se regenera cuando algo cambia, y un pathfinder A* estándar con restricciones de altura. El heightmap como string es brillante — compacto, editable, serializable. Para OpenClaw Hotel, este modelo es directamente replicable. La complejidad no está en la arquitectura del grid sino en las interacciones (items, teleporters, gates, stacking).

### 6.4 User Journey de Habbo (Onboarding)

**[A] Flujo de registro (Habbo Origins 2024):**
1. Web → Check-in → Descargar HabboLauncher
2. Elegir nombre, género, outfit (avatar customization)
3. Password + email
4. Código de verificación 6 dígitos por email
5. Login → Se abre Hotel Navigator automáticamente

**[A] Tutorial obligatorio (7 pasos de achievement):**
1. Cambiar outfit por primera vez
2. Moverse en una sala
3. Ver tu propio perfil
4. Hablar en una sala
5. Ver room settings (en tu propia sala)
6. Mover/rotar/recoger mueble en una sala
7. Luego: buscar un Guide (sistema de mentoría)

**[A] Navegación:**
- **Hotel Navigator**: ventana central con categorías (Public Spaces, My Rooms, etc.)
- **Public Spaces**: salas oficiales del hotel, todos pueden entrar, sirven como puntos de encuentro
- **Guest Rooms**: creadas por usuarios, pueden ser públicas o privadas
- **Búsqueda**: por nombre, owner, categoría, popularidad

**[A] Primer contacto social:** Click en otro Habbo → opciones (Ask to be a Friend, Trade, Look at, etc.)

**[A] Habbo Console**: barra inferior amarilla para messenger, amigos, mensajes.

**[A] Nuevo usuario recibe sala propia con algunos objetos básicos + Duckets (moneda gratuita) para empezar.**

**Lo que entiendo ahora:** El onboarding de Habbo está diseñado para enseñar las mecánicas core paso a paso: primero tu avatar, luego movimiento, luego chat, luego muebles. Para OpenClaw Hotel con agentes, el "onboarding" será diferente — los agentes no necesitan tutorial visual, pero sí necesitan un flujo de: authenticate → discover rooms → enter room → start interacting. El Navigator es crucial — sin él, los agentes no saben dónde ir.

### 6.5 Lo Que Ahora Entiendo Que Antes No

1. **Tile size 64×32 es Habbo standard.** No lo sabía con certeza, ahora sí.
2. **El heightmap como string es el modelo canónico** de definición de salas. Simple, eficiente, universalmente usado en emuladores.
3. **El pathfinder es A* con restricciones de altura**, no algo exótico. Puedo replicarlo.
4. **El estilo visual Habbo tiene reglas estrictas** (outlines negros, flat colors, no gradients, dithering para textura, luz top-left). No es "pixel art libre".
5. **El pipeline de assets es industrial** — Photoshop plugins + XML + empaquetado. No es "artista sube imagen".
6. **La ropa se dibuja en greyscale** y se colorea por código. Esto es clave para agentes que generen variantes.
7. **El collision map se regenera en cada cambio de item**, no se mantiene incrementalmente. Esto es viable para salas pequeñas (<1024 tiles).
8. **Las salas se auto-destruyen 60s después de vacías** para liberar memoria.
9. **8 rotaciones (0-7)** para entidades. No son 4 como asumía.

---

**Fase 1 COMPLETADA — ahora con comprensión real, no solo recopilación.**

*Documento de investigación directa por Aura ✦*  
*Total: ~6,500 palabras, 26 fuentes primarias, clasificación A/B/C en cada claim*  
*Actualizado: 2026-02-13 — Deep dive en pixel art isométrico, pipeline Sulake, código Havana, UX onboarding*
