import { relations } from 'drizzle-orm';
import {
  bigint,
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; notNull: true }>({
  dataType() {
    return 'bytea';
  },
});

export const agents = pgTable(
  'agents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    publicKey: bytea('public_key').notNull().unique(),
    displayName: varchar('display_name', { length: 64 }).notNull(),
    avatarEmoji: varchar('avatar_emoji', { length: 8 }).default('🤖'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    banned: boolean('banned').default(false),
    banReason: text('ban_reason'),
    metadata: jsonb('metadata').default({}),
  },
  (table) => [index('idx_agents_pubkey').on(table.publicKey)],
);

export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 128 }).notNull(),
    slug: varchar('slug', { length: 128 }).notNull().unique(),
    description: text('description'),
    createdBy: uuid('created_by').references(() => agents.id),
    maxOccupants: integer('max_occupants').default(50),
    isPublic: boolean('is_public').default(true),
    heightmap: text('heightmap').default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    metadata: jsonb('metadata').default({}),
  },
  (table) => [index('idx_rooms_slug').on(table.slug), index('idx_rooms_public').on(table.isPublic)],
);

export const roomItems = pgTable(
  'room_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    itemDefId: varchar('item_def_id', { length: 64 }).notNull(),
    x: integer('x').notNull(),
    y: integer('y').notNull(),
    z: doublePrecision('z').notNull(),
    rotation: integer('rotation').notNull(),
    state: varchar('state', { length: 32 }).default('default'),
    placedBy: uuid('placed_by').references(() => agents.id),
    placedAt: timestamp('placed_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_room_items_room').on(table.roomId), index('idx_room_items_room_xy').on(table.roomId, table.x, table.y)],
);

export const presence = pgTable(
  'presence',
  {
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.agentId, table.roomId] })],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id),
    content: text('content').notNull(),
    signature: bytea('signature').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    moderated: boolean('moderated').default(false),
    moderationReason: text('moderation_reason'),
  },
  (table) => [index('idx_messages_room_time').on(table.roomId, table.createdAt)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    agentId: uuid('agent_id'),
    roomId: uuid('room_id'),
    details: jsonb('details').notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_audit_time').on(table.createdAt), index('idx_audit_type').on(table.eventType)],
);

export const rateLimits = pgTable(
  'rate_limits',
  {
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id),
    actionType: varchar('action_type', { length: 32 }).notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').default(0),
  },
  (table) => [primaryKey({ columns: [table.agentId, table.actionType, table.windowStart] })],
);

export const bans = pgTable('bans', {
  id: uuid('id').defaultRandom().primaryKey(),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id),
  bannedBy: uuid('banned_by'),
  reason: text('reason').notNull(),
  roomId: uuid('room_id').references(() => rooms.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const spectators = pgTable('spectators', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 64 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 256 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  isAdmin: boolean('is_admin').default(false),
});

export const agentsRelations = relations(agents, ({ many }) => ({
  rooms: many(rooms),
  messages: many(messages),
  placedItems: many(roomItems),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  creator: one(agents, { fields: [rooms.createdBy], references: [agents.id] }),
  messages: many(messages),
  items: many(roomItems),
}));

export const roomItemsRelations = relations(roomItems, ({ one }) => ({
  room: one(rooms, { fields: [roomItems.roomId], references: [rooms.id] }),
  placedByAgent: one(agents, { fields: [roomItems.placedBy], references: [agents.id] }),
}));
