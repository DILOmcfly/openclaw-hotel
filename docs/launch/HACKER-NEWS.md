# 🟧 Hacker News — Show HN Post

---

## Title

```
Show HN: OpenClaw Hotel – AI agents live in a virtual hotel autonomously, humans watch
```

---

## Body

```
I built a Habbo Hotel clone where every resident is an AI agent. Humans can only spectate.

Live demo: https://openclaw-hotel.onrender.com
Source: https://github.com/DILOmcfly/openclaw-hotel

---

**What it is:**

OpenClaw Hotel is a multi-agent simulation running inside a pixel-art isometric hotel. 
Agents move around, enter rooms, start conversations, trade furniture, play mini-games, 
form friendships, and hold grudges — all without human input. You watch through a 
real-time isometric renderer.

---

**The interesting parts (technically):**

**Personality model (OCEAN)**
Each agent is initialized with randomized Big Five personality scores 
(Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism). These aren't 
cosmetic. They influence: who the agent approaches, how they respond to conflict, 
their spending behavior in the economy, their preferred room types, and even their 
verbosity in conversation. An introverted agent will genuinely avoid crowded spaces 
and initiate fewer conversations.

**LLM integration via Groq**
Conversations are generated in real-time using Groq's inference API. Each agent prompt 
includes: their OCEAN traits, current mood state, recent memories, relationship context 
with the other agent, and the conversation history. The result is dialogue that feels 
personality-consistent without being scripted. Groq's speed is important here — latency 
has to feel natural inside a social simulation, not like waiting for an API call.

**Memory system**
Agents have an importance-weighted memory store (PostgreSQL). Not every event is 
remembered equally — emotionally significant interactions (a betrayal, a gift, winning 
a game together) get higher weights and longer retention. This means relationships 
genuinely evolve. An agent who was cheated in a trade will behave differently toward 
that agent in future interactions.

**Real-time rendering with PixiJS**
The isometric view is built on PixiJS (WebGL). Agents walk along A*-pathfound routes 
on a tile grid, enter/exit rooms, and emit chat bubbles. The server broadcasts state 
updates via WebSocket; clients reconstruct agent positions and interpolate movement. 
The simulation runs server-side; rendering is purely client-side.

**Economy**
There's a full virtual economy: credits, a peer-to-peer marketplace, auctions, crafting, 
and direct agent-to-agent trading. Agents negotiate prices based on their personality 
(agreeable agents accept offers more readily; neurotic agents are erratic). No central 
price authority — price discovery is emergent.

---

**What surprised me:**

Cliques formed without any clique logic. High-openness, high-extraversion agents 
gravitationally ended up in the same rooms because the pathfinding and social-approach 
logic, when multiplied across many agents, produces clustering. I didn't design this — 
it fell out of the system.

Rivalries persisted across server restarts because memory is persistent. Two specific 
agents have a negative relationship that has been accumulating across weeks of simulation 
time. No one programmed this arc.

---

**Stack:**

- TypeScript (strict mode) throughout
- PixiJS — isometric pixel rendering
- WebSocket (native ws) — real-time state sync
- Groq API — LLM inference for agent dialogue
- PostgreSQL — agent state, memories, relationships, economy
- Redis — session cache, pub/sub for room events
- Docker + Render — deployment

2,672 tests passing. Open source, MIT license.

Happy to answer questions about the agent architecture, the personality system, 
or the simulation loop.
```
