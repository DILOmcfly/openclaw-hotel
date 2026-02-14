# OpenClaw Hotel - UI Overlay System

HTML/CSS UI overlay system for OpenClaw Hotel with Habbo-inspired retro/pixel aesthetic.

## Architecture

The UI overlay sits **on top** of the Pixi.js canvas using HTML/CSS, not inside the Pixi scene graph.

### Components

1. **UIManager.ts** - Main UI orchestrator
   - Manages screen transitions (login → navigator → game)
   - Handles all UI events and callbacks
   - Integrates with WebSocket client and game logic

2. **styles.css** - Retro/pixel styling
   - Habbo-inspired color scheme (#1B3B6F base blue)
   - Pixel fonts: "Press Start 2P" & "VT323"
   - Zero border-radius, pixel-perfect borders
   - Smooth screen transitions

## Screens

### 1. Login/Register Screen
- Three tabs: Login, Register, Guest
- Form validation and error display
- Connects to `/api/auth/login`, `/register`, `/guest` (placeholder)
- Auto-transitions to Navigator on success

### 2. Room Navigator
- Grid of available rooms (name, occupants, join button)
- Create room form (name + size selector)
- Logout button
- Auto-loads demo rooms (TODO: connect to real API)

### 3. Game UI (HUD + Chat + Inventory)
- **HUD**: Player name, current room, settings, logout
- **Chat**: Message history + input bar (integrated with ws-client)
- **Inventory**: Toggleable panel, furniture grid, place button

## Integration with main.ts

```typescript
import { UIManager } from './ui/UIManager.js';

const ui = new UIManager();

// Set callbacks
ui.onAuthSuccess = (username, token) => { /* ... */ };
ui.onJoinRoom = (roomId) => { /* ... */ };
ui.onChatMessage = (message) => { /* ... */ };
ui.onCreateRoom = (name, size) => { /* ... */ };
ui.onLogout = () => { /* ... */ };

// Control screens
ui.showScreen('login' | 'navigator' | 'game');

// Update data
ui.loadRooms([...]); 
ui.addChatMessage(username, message);
ui.setCurrentRoom(roomName);
ui.loadInventory([...]);
```

## Styling Guide

### Colors
- `--habbo-blue: #1B3B6F` - Primary
- `--habbo-light-blue: #2E5C8F` - Hover states
- `--habbo-dark-blue: #0F1F3F` - Borders/shadows
- `--habbo-accent: #FFD700` - Highlights

### Fonts
- Headers: `Press Start 2P` (pixel font)
- Body: `VT323` (monospace)

### Border Style
- 3px solid borders
- No border-radius (or minimal 2px max)
- Box shadows for depth effect

## TODO (T-044)

- [ ] Connect auth to real API endpoints
- [ ] Implement room creation API call
- [ ] Add furniture drag & drop functionality
- [ ] Settings modal
- [ ] Mobile responsive tweaks
- [ ] Animation polish (entrance effects)
- [ ] Sound effects (button clicks, chat messages)

## Testing

All existing tests pass:
```bash
npx vitest run
```

Build works with TypeScript:
```bash
npm run build
```

## Demo Mode

Currently runs with **placeholder auth**:
- Any username/password works
- Guest login generates `Guest-{name}` username
- Demo rooms and furniture are hardcoded
- WebSocket connection optional (offline mode works)

This allows frontend development independent of backend completion.
