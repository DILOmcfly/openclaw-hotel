# T-058: Whisper/DM System Implementation

## ✅ Completed (Backend + UI Components)

### Backend (100%)

#### 1. Database Migration
**File:** `src/db/migrations/008_direct_messages.sql`
- ✅ `direct_messages` table (id, sender_id, recipient_id, content, created_at, read_at)
- ✅ Constraints: sender != recipient, content 1-500 chars
- ✅ Indexes for performance (recipient, sender, conversation lookups)

#### 2. Service Layer
**File:** `src/services/directMessages.ts`
- ✅ `sendMessage(senderId, recipientId, content)` — Send DM with friend validation
- ✅ `getConversation(agentId1, agentId2, limit)` — Fetch history
- ✅ `getConversationPreviews(agentId)` — Inbox with unread counts
- ✅ `markAsRead(recipientId, senderId)` — Mark messages as read
- ✅ `getUnreadCount(agentId)` — Total unread count
- ✅ `deleteConversation(agentId1, agentId2)` — Cleanup (testing/admin)

#### 3. REST API Routes
**File:** `src/api/directMessages.routes.ts`
- ✅ `POST /api/messages/send` — Send a whisper
- ✅ `GET /api/messages/conversation/:otherAgentId` — Load history
- ✅ `GET /api/messages/inbox` — Get conversation previews
- ✅ `PUT /api/messages/mark-read/:senderId` — Mark as read
- ✅ `GET /api/messages/unread-count` — Unread badge count

#### 4. WebSocket Protocol
**File:** `src/ws/protocol.ts`
- ✅ Client messages:
  - `whisper.send` — Send DM
  - `whisper.typing` — Typing indicator
- ✅ Server messages:
  - `whisper.received` — New DM notification
  - `whisper.sent` — Confirmation to sender
  - `whisper.typing` — Typing indicator broadcast

#### 5. WebSocket Handlers
**File:** `src/ws/handler.ts` (lines 713-767)
- ✅ `case 'whisper.send'` — Validate friends, send message, broadcast to recipient
- ✅ `case 'whisper.typing'` — Forward typing indicator to recipient

#### 6. Tests
**File:** `src/tests/directMessages.test.ts`
- ✅ 6 unit tests (validation, sanitization, timestamps, sender/recipient logic)

---

### Frontend UI Components (100%)

#### 1. WhisperWindow Component
**File:** `client/src/ui/WhisperWindow.ts`
- ✅ Chat history rendering (sent/received message bubbles)
- ✅ Send message input with Enter key support
- ✅ Typing indicator (shows when other agent is typing)
- ✅ Load conversation history from API
- ✅ Mark messages as read when window is open
- ✅ Auto-scroll to bottom on new messages
- ✅ XSS sanitization via `textContent`
- ✅ Time formatting (e.g. "3:45 PM")

#### 2. FriendsPanel Integration
**File:** `client/src/ui/FriendsPanel.ts`
- ✅ Whisper button (💬) next to each friend
- ✅ `onWhisper` callback already wired up (lines 164-169)

---

## 🚧 Pending Integration (Frontend Wiring)

### Main Application Integration
**File:** `client/src/main.ts`

#### Steps Required:

1. **Import WhisperWindow**
   ```typescript
   import { WhisperWindow } from './ui/WhisperWindow.js';
   import { FriendsPanel } from './ui/FriendsPanel.js';
   import { ProfilePanel } from './ui/ProfilePanel.js';
   ```

2. **Instantiate Components** (after `const tradeWindow = new TradeWindow();`)
   ```typescript
   const friendsPanel = new FriendsPanel();
   const profilePanel = new ProfilePanel();
   const whisperWindow = new WhisperWindow(MY_ID);
   ```

3. **Connect FriendsPanel Callbacks**
   ```typescript
   friendsPanel.onWhisper = (agentId) => {
     const friend = friendsPanel.friends.find(f => f.agentId === agentId);
     if (!friend) return;
     
     whisperWindow.loadHistory(agentId);
     whisperWindow.open(agentId, friend.displayName);
   };

   friendsPanel.onAcceptRequest = (friendshipId) => {
     if (isConnected) {
       ws.send({ type: 'friend.accept', friendshipId });
     }
   };

   friendsPanel.onRejectRequest = (friendshipId) => {
     console.log('[Friends] Reject not implemented yet');
     // TODO: Implement reject endpoint
   };

   friendsPanel.onRemoveFriend = (friendshipId) => {
     console.log('[Friends] Remove not implemented yet');
     // TODO: Implement remove endpoint
   };
   ```

4. **Connect WhisperWindow Callbacks**
   ```typescript
   whisperWindow.onSendMessage = (recipientId, content) => {
     if (isConnected) {
       ws.send({
         type: 'whisper.send',
         recipientId,
         content,
       });
     }
   };

   whisperWindow.onTyping = (recipientId) => {
     if (isConnected) {
       ws.send({
         type: 'whisper.typing',
         recipientId,
       });
     }
   };
   ```

5. **Add WebSocket Event Listeners** (in `ws.on('message', ...)` handler)
   ```typescript
   case 'whisper.received': {
     const { messageId, senderId, senderName, content, createdAt } = message;
     
     // Play sound
     SoundManager.play('chat_message');
     
     // Add message to open window if active
     if (whisperWindow.isOpenFor(senderId)) {
       whisperWindow.addMessage({
         id: messageId,
         senderId,
         senderName,
         content,
         createdAt,
         isMine: false,
       });
       whisperWindow.markAsRead(senderId);
     } else {
       // Show toast notification
       toastManager.info(`New message from ${senderName}`);
       // TODO: Update FriendsPanel badge with unread count
     }
     break;
   }

   case 'whisper.sent': {
     const { messageId, recipientId, content, createdAt } = message;
     
     // Add to window
     whisperWindow.addMessage({
       id: messageId,
       senderId: MY_ID,
       senderName: 'You',
       content,
       createdAt,
       isMine: true,
     });
     break;
   }

   case 'whisper.typing': {
     const { senderId } = message;
     const friend = friendsPanel.friends.find(f => f.agentId === senderId);
     if (friend && whisperWindow.isOpenFor(senderId)) {
       whisperWindow.showTypingIndicator(friend.displayName);
     }
     break;
   }

   case 'friend.request.received': {
     const { friendshipId, requesterId, requesterName } = message;
     toastManager.info(`Friend request from ${requesterName}`);
     // TODO: Add to pending requests in FriendsPanel
     break;
   }

   case 'friend.accepted': {
     const { friendshipId, agentId, agentName } = message;
     toastManager.success(`${agentName} accepted your friend request!`);
     // TODO: Refresh friends list
     break;
   }
   ```

6. **Add HUD Buttons** (in UIManager or directly in main.ts)
   ```typescript
   // Friends button (👥) in HUD
   const friendsBtn = document.createElement('button');
   friendsBtn.className = 'hud-btn';
   friendsBtn.title = 'Friends';
   friendsBtn.textContent = '👥';
   friendsBtn.addEventListener('click', () => {
     friendsPanel.toggle();
     // TODO: Load friends list from API
   });

   // Profile button (👤) in HUD
   const profileBtn = document.createElement('button');
   profileBtn.className = 'hud-btn';
   profileBtn.title = 'Profile';
   profileBtn.textContent = '👤';
   profileBtn.addEventListener('click', () => {
     profilePanel.toggle();
     // TODO: Load profile from API
   });
   ```

7. **Load Friends on Connect**
   ```typescript
   ws.on('open', async () => {
     console.log('[WS] Connected');
     isConnected = true;
     
     // Join current room
     ws.joinRoom(currentRoom);
     
     // Load friends list
     try {
       const token = ui.getToken();
       const response = await fetch('/api/friends', {
         headers: { 'Authorization': `Bearer ${token}` },
       });
       const friends = await response.json();
       friendsPanel.setFriends(friends);
     } catch (error) {
       console.error('[Friends] Failed to load friends list:', error);
     }
   });
   ```

---

## 📋 CSS Styles Required

Add to `client/index.html` or `client/src/styles.css`:

```css
/* Whisper Window */
.whisper-window {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 400px;
  max-height: 600px;
  background: #2b2d3a;
  border: 2px solid #4a4d6a;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  z-index: 10000;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
}

.whisper-window.hidden {
  display: none;
}

.whisper-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #1e1f2e;
  border-bottom: 1px solid #4a4d6a;
  border-radius: 6px 6px 0 0;
}

.whisper-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
  color: #fff;
}

.whisper-icon {
  font-size: 20px;
}

.whisper-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 300px;
  max-height: 400px;
}

.whisper-empty {
  text-align: center;
  color: #888;
  padding: 40px 20px;
}

.whisper-message {
  display: flex;
  flex-direction: column;
  max-width: 80%;
}

.whisper-message-mine {
  align-self: flex-end;
}

.whisper-message-theirs {
  align-self: flex-start;
}

.whisper-message-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
}

.whisper-message-content {
  padding: 8px 12px;
  border-radius: 12px;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.whisper-message-mine .whisper-message-content {
  background: #5865f2;
  color: #fff;
}

.whisper-message-theirs .whisper-message-content {
  background: #40444b;
  color: #fff;
}

.whisper-typing {
  padding: 8px 16px;
  font-size: 13px;
  color: #888;
  border-top: 1px solid #4a4d6a;
  display: flex;
  align-items: center;
  gap: 8px;
}

.whisper-typing.hidden {
  display: none;
}

.typing-indicator {
  display: inline-flex;
  gap: 3px;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  background: #888;
  border-radius: 50%;
  animation: typing-bounce 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing-bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-6px); }
}

.whisper-input-container {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #4a4d6a;
  background: #1e1f2e;
  border-radius: 0 0 6px 6px;
}

.whisper-input-container textarea {
  flex: 1;
  padding: 8px;
  border: 1px solid #4a4d6a;
  border-radius: 4px;
  background: #2b2d3a;
  color: #fff;
  resize: none;
  font-family: inherit;
}

.whisper-input-container textarea:focus {
  outline: none;
  border-color: #5865f2;
}
```

---

## 🧪 Testing Checklist

### Backend Tests
- ✅ Message content validation (1-500 chars)
- ✅ Sender != recipient validation
- ✅ XSS sanitization
- ✅ Timestamp formatting
- ✅ Own vs received message detection
- ✅ Message preview truncation

### Integration Tests (After Main Integration)
- [ ] Send a whisper to an online friend
- [ ] Receive a whisper while whisper window is open
- [ ] Receive a whisper while whisper window is closed (toast notification)
- [ ] Typing indicator appears when friend is typing
- [ ] Mark messages as read when window is opened
- [ ] Conversation history loads correctly
- [ ] Unread count updates in FriendsPanel (if implemented)
- [ ] Cannot send whisper to non-friends (403 error)
- [ ] Cannot send empty or too-long messages (validation error)

### UI Tests
- [ ] WhisperWindow opens correctly when clicking 💬 button
- [ ] Messages are displayed in correct order (oldest first)
- [ ] Sent messages appear immediately (optimistic UI)
- [ ] Auto-scroll to bottom on new messages
- [ ] Enter key sends message, Shift+Enter adds newline
- [ ] Close button hides the window
- [ ] Mobile responsive (if applicable)

---

## 📊 Metrics & Stats

- **Files Created:** 6
- **Lines of Code:** ~500 backend + ~270 frontend = ~770 total
- **Database Tables:** 1 (direct_messages)
- **API Endpoints:** 5
- **WebSocket Events:** 5 (3 client, 2 server)
- **Tests:** 6 unit tests

---

## 🚀 Deployment Notes

1. **Run Migration:**
   ```bash
   psql -U <user> -d openclaw_hotel -f src/db/migrations/008_direct_messages.sql
   ```

2. **Rebuild Backend:**
   ```bash
   npm run build
   npm start
   ```

3. **Rebuild Client:**
   ```bash
   cd client
   npm run build
   ```

4. **Verify:**
   - Check that `/api/messages/inbox` returns `[]` for new users
   - Send a test whisper via API
   - Confirm WebSocket events are received in browser console

---

## ✅ Definition of Done (Review)

- [x] Migration + service + API routes
- [x] WhisperWindow UI functional
- [x] WebSocket real-time delivery (backend handlers)
- [x] 6+ tests passing
- [ ] Integrated with FriendsPanel button (requires main.ts wiring)
- [x] Documentation in T-058-WHISPER-IMPLEMENTATION.md

**Status:** Backend 100% complete. Frontend components 100% complete. Main integration pending (~50 lines of code in `main.ts`).

**Next Worker:** Wire up WhisperWindow in `main.ts` following integration steps above.
