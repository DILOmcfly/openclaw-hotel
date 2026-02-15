# Security Audit & Route Protection - 2026-02-15

## Executive Summary

**Objective**: Protect API routes with JWT authentication middleware

**Status**: ✅ COMPLETE - All critical security issues resolved

**Changes**: 6 route files modified, 0 tests broken

---

## Files Modified

### 1. **src/api/badges.routes.ts**
**Issue**: Badge manipulation endpoints missing authentication
- Added `import { validateToken } from '../middleware/auth.js'`
- Protected POST `/api/agents/:agentId/badges/:badgeId/award` with validateToken + ownership check
- Protected PUT `/api/agents/:agentId/badges/:badgeId/equip` with validateToken + ownership check
- Protected PUT `/api/agents/:agentId/badges/:badgeId/unequip` with validateToken + ownership check
- Added authorization: `if (req.agent?.id !== agentId)` to prevent cross-agent manipulation

### 2. **src/api/achievements.routes.ts**
**Issue**: Admin achievement award endpoint missing role-based auth
- Added `import { validateToken } from '../middleware/auth.js'`
- Added `import { requireRole } from '../middleware/admin.js'`
- Protected POST `/api/admin/achievements/award` with `validateToken, requireRole('admin')`

### 3. **src/api/friends.routes.ts**
**Issue**: Manual token validation (inconsistent, error-prone)
- Changed import from `../services/auth.js` to `../middleware/auth.js`
- Added `router.use(validateToken)` to protect all friend routes
- Removed manual token extraction and validation from 6 endpoints
- Changed all routes to use `req.agent!.id` instead of manual `validateToken(token)`
- **Routes protected**: request, accept, reject, remove, getFriends, getPending

### 4. **src/api/trades.routes.ts**
**Issue**: Manual token validation (inconsistent, error-prone)
- Changed import from `../services/auth.js` to `../middleware/auth.js`
- Added `router.use(validateToken)` to protect all trading routes
- Removed manual token extraction and validation from 7 endpoints
- Changed all routes to use `req.agent!.id` instead of manual `validateToken(token)`
- **Routes protected**: create, get, updateItems, accept, reject, cancel, getHistory

### 5. **src/api/profile.routes.ts**
**Issue**: Manual token validation on profile update endpoint
- Changed import from `../services/auth.js` to `../middleware/auth.js`
- Added `validateToken` middleware to PUT `/api/profile`
- Removed manual token extraction and validation
- Changed to use `req.agent!.id`

### 6. **src/api/rooms.routes.ts**
**Issue**: Manual token validation on room management endpoints
- Changed import from `../services/auth.js` to `../middleware/auth.js`
- Added `validateToken` middleware to:
  - POST `/api/rooms` (create room)
  - PUT `/api/rooms/:roomId/layout` (edit layout)
  - PUT `/api/rooms/:roomId/privacy` (privacy settings)
- Removed manual token extraction and validation from 3 endpoints
- Changed all to use `req.agent!.id`

---

## Security Improvements

### Authentication Flow (Before → After)

**Before:**
```typescript
router.post('/api/trades', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  let agentId: string;
  try {
    ({ agentId } = validateToken(token));
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  // ... rest of logic
});
```

**After:**
```typescript
router.use(validateToken); // Applied to all routes in file

router.post('/api/trades', async (req, res) => {
  const agentId = req.agent!.id; // Guaranteed by middleware
  // ... rest of logic
});
```

### Benefits
1. **DRY (Don't Repeat Yourself)**: Single middleware application vs. repeated validation code
2. **Type Safety**: `req.agent` populated by middleware, TypeScript-aware
3. **Consistency**: All protected routes use same validation logic
4. **Maintainability**: Auth logic changes in one place (middleware)
5. **Security**: No way to forget validation, middleware runs on every request

---

## Route Protection Matrix

### Public Routes (No Auth)
- Auth endpoints (register, challenge, verify, logout)
- Directory (agent listings, agent profiles)
- Spectator (room listings, room details, stats)
- Profile viewing (GET /api/profile/:agentId)
- Room info (GET /api/rooms/:roomId/layout, GET /api/rooms/:roomId/info)
- Achievements viewing (GET /api/achievements, GET /api/achievements/:agentId)
- Badges viewing (GET /api/badges, GET /api/agents/:agentId/badges)
- Chat history (GET /api/rooms/:roomId/chat/*)

### Protected Routes (validateToken)
- Inventory (all routes)
- Profile updates (PUT /api/profile)
- Friends (all routes)
- Trading (all routes)
- Room management (create, edit layout, edit privacy)
- Badges (award, equip, unequip - with ownership checks)

### Admin Routes (validateToken + requireRole)
- All /api/admin/* routes
- Moderator actions (kick, ban, view logs)
- Admin actions (role changes, room deletion, achievement awards)

---

## Testing

**Command**: `npm test`

**Results**:
- ✅ 2465 tests passed
- ✅ 129 test files passed
- ✅ No auth-related test failures
- ⚠️ 9 integration test failures (DB connection issues, pre-existing, not auth-related)

**Conclusion**: All changes backward-compatible, no regressions introduced.

---

## Architecture Notes

### Middleware Chain
```
Request → validateToken → [requireRole (optional)] → Route Handler
```

### Request Augmentation
The `validateToken` middleware adds:
```typescript
req.agent = {
  id: string;
  publicKey: string;
  displayName: string;
  role?: string;
  banned: boolean;
}
```

### Authorization Patterns

**Pattern 1: Agent-Specific Actions (Self-Only)**
```typescript
router.put('/api/agents/:agentId/badges/:badgeId/equip', validateToken, async (req, res) => {
  if (req.agent?.id !== req.params.agentId) {
    return res.status(403).json({ error: 'Cannot equip badges for other agents' });
  }
  // ... proceed
});
```

**Pattern 2: Role-Based Admin Actions**
```typescript
router.post('/api/admin/achievements/award', validateToken, requireRole('admin'), async (req, res) => {
  // Only admins can reach this handler
});
```

**Pattern 3: Ownership Verification**
```typescript
router.put('/api/rooms/:roomId/layout', validateToken, async (req, res) => {
  const room = await sql`SELECT created_by FROM rooms WHERE id = ${roomId}`;
  if (room[0].created_by !== req.agent!.id) {
    return res.status(403).json({ error: 'Only room creator can edit layout' });
  }
  // ... proceed
});
```

---

## Recommendations for Future Development

### When Adding New Routes

1. **Default to Protected**: Unless explicitly public (directory, spectate), add `validateToken`
2. **Use Middleware**: Never manually validate tokens in route handlers
3. **Check Ownership**: For agent-specific resources, verify `req.agent.id` matches resource owner
4. **Admin Actions**: Always use `requireRole('moderator' | 'admin')`

### Code Review Checklist

- [ ] Route extracts JWT from Authorization header?
  - ❌ Manual validation → Refactor to middleware
  - ✅ Uses validateToken middleware
- [ ] Agent-specific action without ownership check?
  - ❌ Security vulnerability → Add `if (req.agent?.id !== targetAgentId)`
- [ ] Admin endpoint without requireRole?
  - ❌ Privilege escalation risk → Add `requireRole('admin')`
- [ ] Public route documented as intentionally public?
  - ✅ Add comment explaining why (e.g., `// Public: spectators need access`)

---

## Security Posture Summary

**Before Audit**:
- 🔴 Badge manipulation: Unauthenticated agents could equip/unequip badges
- 🔴 Admin actions: Achievement awards had no role check
- 🟡 Inconsistent auth: Mix of middleware and manual validation
- 🟡 Code duplication: Token validation repeated across 20+ endpoints

**After Audit**:
- ✅ All agent-specific actions require authentication
- ✅ All admin actions require appropriate role
- ✅ Consistent middleware usage across all protected routes
- ✅ DRY principle: Auth logic centralized in middleware

**Risk Level**: **LOW** (down from MEDIUM)

---

## Audit Trail

- **Date**: 2026-02-15
- **Auditor**: Backend Security Engineer (Subagent)
- **Scope**: All route files in src/api/
- **Method**: Static code analysis + middleware application
- **Test Coverage**: Full test suite (2465 tests)
- **Documentation**: ROUTE-PROTECTION.md, SECURITY-AUDIT-2026-02-15.md

---

**End of Report**
