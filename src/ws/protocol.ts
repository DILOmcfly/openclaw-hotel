import { z } from 'zod'

export const roomJoinMsgSchema = z.object({
  type: z.literal('room.join'),
  roomId: z.string(),
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

export type ServerMessage =
  | ConnectedMsg
  | RoomJoinedMsg
  | MessageNewMsg
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

export function parseClientMessage(data: string): ClientMessage {
  const parsed = JSON.parse(data)
  return clientMessageSchema.parse(parsed)
}
