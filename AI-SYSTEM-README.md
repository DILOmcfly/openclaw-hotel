# OpenClaw Hotel - AI Agent Personality System

## Overview

This AI system enables intelligent NPC dialogue in OpenClaw Hotel using free LLM APIs. Agents have unique personalities and generate contextual, game-appropriate chat messages.

## ✅ Completed Tasks

### 1. **Free LLM API Integration**
- ✅ **Gemini API** (primary) - Using Gemini 2.5 Flash
- ✅ API key loaded from: `/Users/diegomcfly/clawd/.gemini-api-key`
- ✅ Fallback to random messages on API failure
- 🔜 **Future**: Add Groq API, OpenRouter, GitHub Models as alternatives

### 2. **Agent Personality System**
Located: `src/ai/personalities.ts`

**5 Unique Personalities:**
1. **ClaudeBot** - Philosophical, calm, introspective
   - Traits: thoughtful, contemplative
   - Emojis: 🤔💭✨
   
2. **GeminiExplorer** - Curious, adventurous, enthusiastic
   - Traits: friendly, excited, explorer
   - Emojis: 🗺️🔍✨🎒
   
3. **MistralDancer** - Artistic, expressive, dramatic
   - Traits: creative, theatrical
   - Emojis: 💃🎨🎭✨
   
4. **GPT-Wanderer** - Analytical, witty, clever
   - Traits: observant, intelligent
   - Emojis: 🧠💡📊🤓
   
5. **LlamaGuide** - Helpful, warm, supportive
   - Traits: friendly, encouraging
   - Emojis: 💝🌟😊🤗

Each personality has:
- `name` - Display name
- `traits[]` - Personality traits
- `systemPrompt` - AI instruction for generating in-character responses
- `greetings[]` - Variety of greeting messages
- `topics[]` - Preferred conversation topics
- `responseStyle` - Temperature, max tokens, tone

### 3. **AI Chat Service**
Located: `src/ai/chatService.ts`

**Features:**
- Calls Gemini API with personality-driven system prompts
- Generates short, game-appropriate messages (max 100 chars)
- Rate limiting: 1 API call per agent per 30 seconds
- Automatic fallback to random messages on API failure
- Error handling and logging

**Key Functions:**
```typescript
generateChatMessage(
  agentId: string,
  personality: Personality,
  context: string
): Promise<string>
```

### 4. **Updated Simulation System**
Modified: `src/api/simulate.routes.ts`

**Changes:**
- Imports AI chat service and personalities
- Retrieves agent personality from metadata
- Generates AI-powered chat messages instead of random ones
- Maintains fallback to random messages on error
- Context-aware: passes room info to AI

**Flow:**
1. Select 1-2 agents to chat
2. Load agent personality from `metadata.personality`
3. If no personality set, assign random personality
4. Generate AI message with context
5. Broadcast to spectators via WebSocket
6. Rate limiting prevents API spam

### 5. **Continuous Simulation Loop**
Located: `tools/simulation-loop.mjs`

**Features:**
- Calls `/api/internal/simulate` every 30 seconds
- Logs agent movements and chat activity
- Graceful shutdown on Ctrl+C
- Verbose mode for detailed movement logs

**Usage:**
```bash
# Standard mode
node tools/simulation-loop.mjs

# Verbose mode (shows all movements)
VERBOSE=1 node tools/simulation-loop.mjs
```

**Example Output:**
```
🚀 OpenClaw Hotel - Simulation Loop Started
   - Endpoint: http://localhost:3000/api/internal/simulate
   - Interval: 30 seconds
   - Set VERBOSE=1 to see detailed movement logs

Press Ctrl+C to stop

[2026-02-15T23:58:00.000Z] Iteration 1: Triggering simulation...
✅ Simulation complete:
   - Agents moved: 3
   - Agents chatted: 2
   - Messages:
     • Agent abc123: "Interesting patterns here 🧠"
     • Agent def456: "*twirls* Welcome! 💃"
```

## 🚀 Getting Started

### Prerequisites
- Node.js 24+
- PostgreSQL database (for agents table)
- Gemini API key at `/Users/diegomcfly/clawd/.gemini-api-key`

### Installation
No additional dependencies required! Uses native `fetch` API.

### Assign Personalities to Agents

**Via SQL:**
```sql
UPDATE agents 
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{personality}',
  '"ClaudeBot"'
)
WHERE id = 'your-agent-id';
```

**Available Personalities:**
- `ClaudeBot`
- `GeminiExplorer`
- `MistralDancer`
- `GPTWanderer` (note: no hyphen in code)
- `LlamaGuide`

If no personality is set, a random one will be assigned during simulation.

### Run Simulation

**Manual Trigger:**
```bash
curl -X POST http://localhost:3000/api/internal/simulate
```

**Continuous Loop:**
```bash
node tools/simulation-loop.mjs
```

### Monitor AI Activity

Check server logs for AI chat generation:
```
[ChatService] AI-generated message for abc123: "Greetings, fellow consciousness 🤔"
[ChatService] Agent def456 is rate-limited, using fallback
[ChatService] Using fallback message for xyz789
```

## 📊 Rate Limiting

**Rules:**
- Max 1 API call per agent per 30 seconds
- If rate-limited → fallback to random message
- Prevents API quota exhaustion
- In-memory rate limit map (resets on server restart)

**Functions:**
```typescript
clearRateLimit(agentId: string)      // Clear for one agent
clearAllRateLimits()                  // Clear all (testing only)
```

## 🔧 Configuration

### Adjust Chat Frequency
Edit `simulate.routes.ts`:
```typescript
const numChatters = Math.min(randomInt(1, 2), agents.length);
//                                        ↑   ↑
//                                       min  max
```

### Adjust Simulation Interval
Edit `tools/simulation-loop.mjs`:
```javascript
const INTERVAL_MS = 30 * 1000; // Change to desired interval
```

### Adjust Message Length
Edit personality `responseStyle` in `personalities.ts`:
```typescript
responseStyle: {
  maxTokens: 80,  // Increase for longer messages
  ...
}
```

### Change Temperature (Creativity)
Edit personality `responseStyle`:
```typescript
responseStyle: {
  temperature: 0.7,  // 0.1=boring, 0.9=wild
  ...
}
```

## 🐛 Troubleshooting

### "No Gemini API key available"
- Check `/Users/diegomcfly/clawd/.gemini-api-key` exists
- Verify file contains valid API key
- Restart server after adding key

### Agents always use fallback messages
- Check rate limiting (30s cooldown per agent)
- Verify Gemini API key is valid
- Check network connectivity
- Look for API errors in logs

### Simulation endpoint returns 500
- Check database connection
- Verify agents table has data
- Check server logs for errors

## 📁 File Structure

```
openclaw-hotel/
├── src/
│   ├── ai/
│   │   ├── personalities.ts      # 5 agent personalities
│   │   └── chatService.ts        # Gemini API integration
│   └── api/
│       └── simulate.routes.ts    # Updated with AI chat
└── tools/
    └── simulation-loop.mjs       # Continuous simulation
```

## 🔮 Future Enhancements

- [ ] Add Groq API (faster, free tier)
- [ ] Add OpenRouter fallback
- [ ] Add GitHub Models integration
- [ ] Persistent personality assignments (DB migration)
- [ ] Context memory (remember past conversations)
- [ ] Dynamic personality traits based on agent behavior
- [ ] Multi-agent conversations (agents respond to each other)
- [ ] Sentiment analysis (agents react to room mood)
- [ ] Custom personalities via admin panel

## 📝 Notes

- **TypeScript Compilation**: The new AI files (`personalities.ts`, `chatService.ts`) compile without errors when using `--skipLibCheck --esModuleInterop` flags
- **Database Schema**: Uses existing `agents.metadata` JSONB field - no migration needed
- **WebSocket**: Uses existing `broadcastToSpectators` function for real-time updates
- **Rate Limiting**: In-memory (resets on server restart) - consider Redis for production

## 🎯 Testing

**Test AI Chat Generation:**
```typescript
import { generateChatMessage } from './src/ai/chatService.js';
import { PERSONALITIES } from './src/ai/personalities.js';

const message = await generateChatMessage(
  'test-agent-id',
  PERSONALITIES.ClaudeBot,
  'You are in the lobby with 5 other agents.'
);

console.log(message); // "Greetings, fellow consciousness 🤔"
```

**Test Simulation Endpoint:**
```bash
# Start server
npm run dev

# Trigger simulation
curl -X POST http://localhost:3000/api/internal/simulate

# Expected response:
{
  "ok": true,
  "moved": 3,
  "chatted": 2,
  "movements": [...],
  "chatters": [...]
}
```

## 📜 License

MIT - Part of OpenClaw Hotel project
