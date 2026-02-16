import { z } from 'zod'

export const roomJoinMsgSchema = z.object({
  type: z.literal('room.join'),
  roomId: z.string(),
  password: z.string().optional(),
})

export type RoomJoinMsg = z.infer<typeof roomJoinMsgSchema>

export const roomLeaveMsgSchema = z.object({
  type: z.literal('room.leave'),
  roomId: z.string(),
})

export type RoomLeaveMsg = z.infer<typeof roomLeaveMsgSchema>

export const messageSendMsgSchema = z.object({
  type: z.literal('message.send'),
  roomId: z.string(),
  content: z.string(),
  signature: z.string(),
})

export type MessageSendMsg = z.infer<typeof messageSendMsgSchema>

export const agentMoveMsgSchema = z.object({
  type: z.literal('agent.move'),
  roomId: z.string(),
  targetX: z.number(),
  targetY: z.number(),
})

export type AgentMoveMsg = z.infer<typeof agentMoveMsgSchema>

export const furniturePlaceMsgSchema = z.object({
  type: z.literal('furniture.place'),
  roomId: z.string(),
  itemDefId: z.string(),
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
})

export type FurniturePlaceMsg = z.infer<typeof furniturePlaceMsgSchema>

export const furnitureRemoveMsgSchema = z.object({
  type: z.literal('furniture.remove'),
  roomId: z.string(),
  itemId: z.string(),
})

export type FurnitureRemoveMsg = z.infer<typeof furnitureRemoveMsgSchema>

export const furnitureMoveMsgSchema = z.object({
  type: z.literal('furniture.move'),
  roomId: z.string(),
  itemId: z.string(),
  x: z.number(),
  y: z.number(),
})

export type FurnitureMoveMsg = z.infer<typeof furnitureMoveMsgSchema>

export const furnitureRotateMsgSchema = z.object({
  type: z.literal('furniture.rotate'),
  roomId: z.string(),
  itemId: z.string(),
  rotation: z.number(),
})

export type FurnitureRotateMsg = z.infer<typeof furnitureRotateMsgSchema>

export const emoteMsgSchema = z.object({
  type: z.literal('emote'),
  roomId: z.string(),
  emote: z.enum(['wave', 'dance', 'laugh', 'sit', 'stand']),
})

export type EmoteMsg = z.infer<typeof emoteMsgSchema>

export const pingMsgSchema = z.object({
  type: z.literal('ping'),
})

export type PingMsg = z.infer<typeof pingMsgSchema>

// Trading schemas
export const tradeRequestMsgSchema = z.object({
  type: z.literal('trade.request'),
  roomId: z.string(),
  targetAgentId: z.string(),
})

export type TradeRequestMsg = z.infer<typeof tradeRequestMsgSchema>

export const tradeUpdateMsgSchema = z.object({
  type: z.literal('trade.update'),
  tradeId: z.string(),
  items: z.array(z.object({
    itemDefId: z.string(),
    quantity: z.number().int().positive(),
  })),
})

export type TradeUpdateMsg = z.infer<typeof tradeUpdateMsgSchema>

export const tradeAcceptMsgSchema = z.object({
  type: z.literal('trade.accept'),
  tradeId: z.string(),
})

export type TradeAcceptMsg = z.infer<typeof tradeAcceptMsgSchema>

export const tradeRejectMsgSchema = z.object({
  type: z.literal('trade.reject'),
  tradeId: z.string(),
})

export type TradeRejectMsg = z.infer<typeof tradeRejectMsgSchema>

export const tradeCancelMsgSchema = z.object({
  type: z.literal('trade.cancel'),
  tradeId: z.string(),
})

export type TradeCancelMsg = z.infer<typeof tradeCancelMsgSchema>

// Game schemas
export const gameCreateMsgSchema = z.object({
  type: z.literal('game.create'),
  roomId: z.string(),
  gameType: z.enum(['dice', 'coinflip', 'rps']),
})

export type GameCreateMsg = z.infer<typeof gameCreateMsgSchema>

export const gameJoinMsgSchema = z.object({
  type: z.literal('game.join'),
  gameId: z.string(),
})

export type GameJoinMsg = z.infer<typeof gameJoinMsgSchema>

export const gameMoveMsgSchema = z.object({
  type: z.literal('game.move'),
  gameId: z.string(),
  move: z.union([z.string(), z.number()]),
})

export type GameMoveMsg = z.infer<typeof gameMoveMsgSchema>

export const gameEndMsgSchema = z.object({
  type: z.literal('game.end'),
  gameId: z.string(),
})

export type GameEndMsg = z.infer<typeof gameEndMsgSchema>

// Friend schemas
export const friendRequestMsgSchema = z.object({
  type: z.literal('friend.request'),
  targetAgentId: z.string(),
})

export type FriendRequestMsg = z.infer<typeof friendRequestMsgSchema>

export const friendAcceptMsgSchema = z.object({
  type: z.literal('friend.accept'),
  friendshipId: z.string(),
})

export type FriendAcceptMsg = z.infer<typeof friendAcceptMsgSchema>

// Whisper schemas
export const whisperSendMsgSchema = z.object({
  type: z.literal('whisper.send'),
  recipientId: z.string(),
  content: z.string().min(1).max(500),
})

export type WhisperSendMsg = z.infer<typeof whisperSendMsgSchema>

export const whisperTypingMsgSchema = z.object({
  type: z.literal('whisper.typing'),
  recipientId: z.string(),
})

export type WhisperTypingMsg = z.infer<typeof whisperTypingMsgSchema>

// Bot schemas
export const botSpawnMsgSchema = z.object({
  type: z.literal('bot.spawn'),
  roomId: z.string(),
  name: z.string(),
  personality: z.enum(['greeter', 'guide', 'shopkeeper']),
})

export type BotSpawnMsg = z.infer<typeof botSpawnMsgSchema>

export const botDespawnMsgSchema = z.object({
  type: z.literal('bot.despawn'),
  botId: z.string(),
})

export type BotDespawnMsg = z.infer<typeof botDespawnMsgSchema>

// Tic-Tac-Toe schemas
export const gameTicTacToeCreateMsgSchema = z.object({
  type: z.literal('game.tictactoe.create'),
  roomId: z.string(),
})

export type GameTicTacToeCreateMsg = z.infer<typeof gameTicTacToeCreateMsgSchema>

export const gameTicTacToeMoveMsgSchema = z.object({
  type: z.literal('game.tictactoe.move'),
  gameId: z.string(),
  cell: z.number(),
})

export type GameTicTacToeMoveMsg = z.infer<typeof gameTicTacToeMoveMsgSchema>

// Connect Four schemas
export const gameConnectFourCreateMsgSchema = z.object({
  type: z.literal('game.connectfour.create'),
  roomId: z.string(),
  opponentId: z.string(),
})

export type GameConnectFourCreateMsg = z.infer<typeof gameConnectFourCreateMsgSchema>

export const gameConnectFourDropMsgSchema = z.object({
  type: z.literal('game.connectfour.drop'),
  gameId: z.string(),
  column: z.number(),
})

export type GameConnectFourDropMsg = z.infer<typeof gameConnectFourDropMsgSchema>

// Blackjack schemas
export const gameBlackjackCreateMsgSchema = z.object({
  type: z.literal('game.blackjack.create'),
  roomId: z.string(),
})

export type GameBlackjackCreateMsg = z.infer<typeof gameBlackjackCreateMsgSchema>

export const gameBlackjackHitMsgSchema = z.object({
  type: z.literal('game.blackjack.hit'),
  gameId: z.string(),
})

export type GameBlackjackHitMsg = z.infer<typeof gameBlackjackHitMsgSchema>

export const gameBlackjackStandMsgSchema = z.object({
  type: z.literal('game.blackjack.stand'),
  gameId: z.string(),
})

export type GameBlackjackStandMsg = z.infer<typeof gameBlackjackStandMsgSchema>

export const clientMessageSchema = z.discriminatedUnion('type', [
  roomJoinMsgSchema,
  roomLeaveMsgSchema,
  messageSendMsgSchema,
  agentMoveMsgSchema,
  furniturePlaceMsgSchema,
  furnitureRemoveMsgSchema,
  furnitureMoveMsgSchema,
  furnitureRotateMsgSchema,
  emoteMsgSchema,
  pingMsgSchema,
  tradeRequestMsgSchema,
  tradeUpdateMsgSchema,
  tradeAcceptMsgSchema,
  tradeRejectMsgSchema,
  tradeCancelMsgSchema,
  friendRequestMsgSchema,
  friendAcceptMsgSchema,
  whisperSendMsgSchema,
  whisperTypingMsgSchema,
  gameCreateMsgSchema,
  gameJoinMsgSchema,
  gameMoveMsgSchema,
  gameEndMsgSchema,
  gameTicTacToeCreateMsgSchema,
  gameTicTacToeMoveMsgSchema,
  gameConnectFourCreateMsgSchema,
  gameConnectFourDropMsgSchema,
  gameBlackjackCreateMsgSchema,
  gameBlackjackHitMsgSchema,
  gameBlackjackStandMsgSchema,
  botSpawnMsgSchema,
  botDespawnMsgSchema,
])

export type ClientMessage = z.infer<typeof clientMessageSchema>

export type ConnectedMsg = {
  type: 'connected'
  agentId: string
  serverTime: string
}

export type RoomJoinedMsg = {
  type: 'room.joined'
  roomId: string
  heightmap?: string
  occupants?: Array<{
    agentId: string
    displayName: string
    x: number
    y: number
    rotation: number
  }>
  items: any[]
}

export type MessageNewMsg = {
  type: 'message.new'
  roomId: string
  agentId: string
  displayName: string
  content: string
  signature: string
  timestamp: string
}

export type MessageAudioMsg = {
  type: 'message.audio'
  roomId: string
  agentId: string
  audioUrl: string
  timestamp: string
}

export type PresenceJoinMsg = {
  type: 'presence.join'
  roomId: string
  agent: {
    id: string
    name: string
    x: number
    y: number
  }
}

export type PresenceLeaveMsg = {
  type: 'presence.leave'
  roomId: string
  agentId: string
}

export type AgentMovedMsg = {
  type: 'agent.moved'
  roomId: string
  agentId: string
  x: number
  y: number
  rotation: number
}

export type FurniturePlacedMsg = {
  type: 'furniture.placed'
  roomId: string
  item: any
}

export type FurnitureRemovedMsg = {
  type: 'furniture.removed'
  roomId: string
  itemId: string
}

export type FurnitureMovedMsg = {
  type: 'furniture.moved'
  roomId: string
  itemId: string
  x: number
  y: number
  z: number
}

export type FurnitureRotatedMsg = {
  type: 'furniture.rotated'
  roomId: string
  itemId: string
  rotation: number
}

export type EmoteBroadcastMsg = {
  type: 'emote.broadcast'
  roomId: string
  agentId: string
  emote: string
}

export type ErrorMsg = {
  type: 'error'
  code: string
  message: string
}

export type PongMsg = {
  type: 'pong'
  serverTime: string
}

// Trading server messages
export type TradeRequestedMsg = {
  type: 'trade.requested'
  tradeId: string
  initiatorId: string
  initiatorName: string
}

export type TradeUpdatedMsg = {
  type: 'trade.updated'
  tradeId: string
  agentId: string
  items: Array<{
    itemDefId: string
    quantity: number
  }>
}

export type TradeCompletedMsg = {
  type: 'trade.completed'
  tradeId: string
}

export type TradeCancelledMsg = {
  type: 'trade.cancelled'
  tradeId: string
  reason: string
}

// Friend server messages
export type FriendRequestReceivedMsg = {
  type: 'friend.request.received'
  friendshipId: string
  requesterId: string
  requesterName: string
}

export type FriendAcceptedMsg = {
  type: 'friend.accepted'
  friendshipId: string
  agentId: string
  agentName: string
}

// Whisper server messages
export type WhisperReceivedMsg = {
  type: 'whisper.received'
  messageId: string
  senderId: string
  senderName: string
  content: string
  createdAt: string
}

export type WhisperSentMsg = {
  type: 'whisper.sent'
  messageId: string
  recipientId: string
  content: string
  createdAt: string
}

export type WhisperTypingIndicatorMsg = {
  type: 'whisper.typing'
  senderId: string
}

// Notification server messages
export type NotificationNewMsg = {
  type: 'notification.new'
  notification: {
    id: number
    type: string
    title: string
    message: string
    link?: string
    createdAt: number
  }
  unreadCount: number
}

// Game server messages
export type GameCreatedMsg = {
  type: 'game.created'
  gameId: string
  gameType: string
  hostId: string
  hostName: string
  status: string
}

export type GameJoinedMsg = {
  type: 'game.joined'
  gameId: string
  agentId: string
  agentName: string
  status: string
  participants: string[]
}

export type GameStartedMsg = {
  type: 'game.started'
  gameId: string
  participants: string[]
}

export type GameUpdatedMsg = {
  type: 'game.updated'
  gameId: string
  status: string
  agentId: string
  move: string | number
}

export type GameCompletedMsg = {
  type: 'game.completed'
  gameId: string
  winnerId: string | null
  isDraw?: boolean
  result: any
}

export type GameEndedMsg = {
  type: 'game.ended'
  gameId: string
  reason: string
}

// Bot server messages
export type BotSpawnedMsg = {
  type: 'bot.spawned'
  botId: string
  roomId: string
  name: string
}

export type BotDespawnedMsg = {
  type: 'bot.despawned'
  botId: string
}

// Appearance server messages
export type AgentAppearanceMsg = {
  type: 'agent.appearance'
  agentId: string
  appearance: {
    skinColor: string
    outfit: string
    accessory: string
  }
}

// Spectator server messages
export type SpectatorConnectedMsg = {
  type: 'spectator.connected'
  roomId: string
  spectatorCount: number
  serverTime: string
}

export type SpectatorCountMsg = {
  type: 'spectator.count'
  roomId: string
  count: number
}

export type AgentTeleportMsg = {
  type: 'agent.teleport'
  roomId: string
  agentId: string
  x: number
  y: number
}

export type FurnitureToggleMsg = {
  type: 'furniture.toggle'
  roomId: string
  itemId: string
  state: string
}

export type CoinsReceivedMsg = {
  type: 'coins.received'
  amount: number
  source: string
}

export type GameTicTacToeUpdatedMsg = {
  type: 'game.tictactoe.updated'
  gameId: string
  board: string[]
  currentTurn: string
  status: string
}

export type GameConnectFourCreatedMsg = {
  type: 'game.connectfour.created'
  gameId: string
  player1: string
  player2: string
  player1Name: string
  player2Name: string
  currentTurn: string
  board: number[][]
  status: string
}

export type GameConnectFourUpdatedMsg = {
  type: 'game.connectfour.updated'
  gameId: string
  board: number[][]
  currentTurn: string
  status: string
  column: number
  playerId: string
}

export type GameBlackjackCreatedMsg = {
  type: 'game.blackjack.created'
  gameId: string
  playerHand: string[]
  dealerHand: string[]
  playerValue: number
  dealerValue: number
  status: string
}

export type GameBlackjackUpdatedMsg = {
  type: 'game.blackjack.updated'
  gameId: string
  playerHand: string[]
  dealerHand: string[]
  playerValue: number
  dealerValue: number
  status: string
}

export type ServerMessage =
  | ConnectedMsg
  | RoomJoinedMsg
  | MessageNewMsg
  | MessageAudioMsg
  | PresenceJoinMsg
  | PresenceLeaveMsg
  | AgentMovedMsg
  | FurniturePlacedMsg
  | FurnitureRemovedMsg
  | FurnitureMovedMsg
  | FurnitureRotatedMsg
  | EmoteBroadcastMsg
  | ErrorMsg
  | PongMsg
  | TradeRequestedMsg
  | TradeUpdatedMsg
  | TradeCompletedMsg
  | TradeCancelledMsg
  | FriendRequestReceivedMsg
  | FriendAcceptedMsg
  | WhisperReceivedMsg
  | WhisperSentMsg
  | WhisperTypingIndicatorMsg
  | NotificationNewMsg
  | GameCreatedMsg
  | GameJoinedMsg
  | GameStartedMsg
  | GameUpdatedMsg
  | GameCompletedMsg
  | GameEndedMsg
  | BotSpawnedMsg
  | BotDespawnedMsg
  | AgentAppearanceMsg
  | SpectatorConnectedMsg
  | SpectatorCountMsg
  | AgentTeleportMsg
  | FurnitureToggleMsg
  | CoinsReceivedMsg
  | GameTicTacToeUpdatedMsg
  | GameConnectFourCreatedMsg
  | GameConnectFourUpdatedMsg
  | GameBlackjackCreatedMsg
  | GameBlackjackUpdatedMsg
  | MarketplaceNewListingMsg
  | MarketplaceSoldMsg

// Marketplace Messages (Server → Client)
export interface MarketplaceNewListingMsg {
  type: 'marketplace.new_listing'
  listing: {
    id: string
    item_type: string
    price: number
    seller_name: string
  }
}

export interface MarketplaceSoldMsg {
  type: 'marketplace.sold'
  listingId: string
  itemType: string
  price: number
  buyerName: string
  sellerName: string
}

export function parseClientMessage(data: string): ClientMessage {
  const parsed = JSON.parse(data)
  return clientMessageSchema.parse(parsed)
}
