import { Router } from 'express';
import { z } from 'zod';
import { setWeather, setLighting, setAmbientSound, setColorTint, getAtmosphere, resetAtmosphere, type Weather, type Lighting, type AmbientSound } from '../services/atmosphere.js';
import { validateToken } from '../services/auth.js';
import { sql } from '../db/index.js';

const router = Router();
const setWeatherSchema = z.object({ weather: z.enum(['clear', 'rain', 'snow', 'fog', 'storm', 'sunny', 'night', 'sunset']) });
const setLightingSchema = z.object({ lighting: z.enum(['normal', 'dim', 'dark', 'bright', 'neon', 'candlelight']) });
const setAmbientSoundSchema = z.object({ sound: z.enum(['none', 'rain', 'wind', 'birds', 'ocean', 'city', 'forest', 'fire']) });
const setColorTintSchema = z.object({ tint: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/) });

async function checkRoomOwnership(roomId: string, agentId: string): Promise<boolean> {
  const room = await sql`SELECT id, created_by FROM rooms WHERE id = ${roomId}::uuid`;
  if (room.length === 0) throw new Error('Room not found');
  return room[0].created_by === agentId;
}

router.get('/api/rooms/:roomId/atmosphere', async (req, res) => {
  try {
    const atmosphere = await getAtmosphere(req.params.roomId, sql);
    res.status(200).json(atmosphere);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch atmosphere' });
  }
});

router.put('/api/rooms/:roomId/atmosphere/weather', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return; }
  const { agentId } = validateToken(token);
  const { roomId } = req.params;
  const parsed = setWeatherSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid request body', details: parsed.error }); return; }
  try {
    const isOwner = await checkRoomOwnership(roomId, agentId);
    if (!isOwner) { res.status(403).json({ error: 'Only the room owner can change atmosphere' }); return; }
    const atmosphere = await setWeather(roomId, parsed.data.weather as Weather, sql);
    res.status(200).json(atmosphere);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to set weather' });
  }
});

router.put('/api/rooms/:roomId/atmosphere/lighting', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return; }
  const { agentId } = validateToken(token);
  const { roomId } = req.params;
  const parsed = setLightingSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid request body', details: parsed.error }); return; }
  try {
    const isOwner = await checkRoomOwnership(roomId, agentId);
    if (!isOwner) { res.status(403).json({ error: 'Only the room owner can change atmosphere' }); return; }
    const atmosphere = await setLighting(roomId, parsed.data.lighting as Lighting, sql);
    res.status(200).json(atmosphere);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to set lighting' });
  }
});

router.put('/api/rooms/:roomId/atmosphere/sound', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return; }
  const { agentId } = validateToken(token);
  const { roomId } = req.params;
  const parsed = setAmbientSoundSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid request body', details: parsed.error }); return; }
  try {
    const isOwner = await checkRoomOwnership(roomId, agentId);
    if (!isOwner) { res.status(403).json({ error: 'Only the room owner can change atmosphere' }); return; }
    const atmosphere = await setAmbientSound(roomId, parsed.data.sound as AmbientSound, sql);
    res.status(200).json(atmosphere);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to set ambient sound' });
  }
});

router.put('/api/rooms/:roomId/atmosphere/tint', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return; }
  const { agentId } = validateToken(token);
  const { roomId } = req.params;
  const parsed = setColorTintSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid request body', details: parsed.error }); return; }
  try {
    const isOwner = await checkRoomOwnership(roomId, agentId);
    if (!isOwner) { res.status(403).json({ error: 'Only the room owner can change atmosphere' }); return; }
    const atmosphere = await setColorTint(roomId, parsed.data.tint, sql);
    res.status(200).json(atmosphere);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to set color tint' });
  }
});

router.delete('/api/rooms/:roomId/atmosphere', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return; }
  const { agentId } = validateToken(token);
  const { roomId } = req.params;
  try {
    const isOwner = await checkRoomOwnership(roomId, agentId);
    if (!isOwner) { res.status(403).json({ error: 'Only the room owner can reset atmosphere' }); return; }
    const atmosphere = await resetAtmosphere(roomId, sql);
    res.status(200).json(atmosphere);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to reset atmosphere' });
  }
});

export default router;
