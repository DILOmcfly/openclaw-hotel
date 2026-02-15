import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import {
  takePhoto,
  likePhoto,
  getPhotosByRoom,
  getPhotosByAgent,
  getPopularPhotos,
  deletePhoto,
} from '../services/photos.js';

const router = express.Router();

/**
 * POST /api/photos
 * Take a photo in a room
 */
router.post('/api/photos', async (req, res) => {
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

  const { roomId, caption = '' } = req.body;

  if (!roomId) {
    return res.status(400).json({ error: 'roomId is required' });
  }

  try {
    const photo = await takePhoto(roomId, agentId, caption, sql);
    res.status(201).json({ photo });
  } catch (error: any) {
    console.error('[Photos API] Take photo error:', error);
    res.status(400).json({ error: error.message || 'Failed to take photo' });
  }
});

/**
 * POST /api/photos/:id/like
 * Toggle like on a photo
 */
router.post('/api/photos/:id/like', async (req, res) => {
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

  const { id: photoId } = req.params;

  try {
    const result = await likePhoto(photoId, agentId, sql);
    res.json(result);
  } catch (error: any) {
    console.error('[Photos API] Like photo error:', error);
    res.status(400).json({ error: error.message || 'Failed to like photo' });
  }
});

/**
 * GET /api/photos/room/:roomId
 * Get photos for a specific room
 */
router.get('/api/photos/room/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const limit = parseInt(req.query.limit as string) || 20;

  try {
    const photos = await getPhotosByRoom(roomId, limit, sql);
    res.json({ photos });
  } catch (error: any) {
    console.error('[Photos API] Get photos by room error:', error);
    res.status(500).json({ error: 'Failed to get photos' });
  }
});

/**
 * GET /api/photos/agent/:agentId
 * Get photos taken by a specific agent
 */
router.get('/api/photos/agent/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const limit = parseInt(req.query.limit as string) || 20;

  try {
    const photos = await getPhotosByAgent(agentId, limit, sql);
    res.json({ photos });
  } catch (error: any) {
    console.error('[Photos API] Get photos by agent error:', error);
    res.status(500).json({ error: 'Failed to get photos' });
  }
});

/**
 * GET /api/photos/popular
 * Get popular photos sorted by likes
 */
router.get('/api/photos/popular', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;

  try {
    const photos = await getPopularPhotos(limit, sql);
    res.json({ photos });
  } catch (error: any) {
    console.error('[Photos API] Get popular photos error:', error);
    res.status(500).json({ error: 'Failed to get popular photos' });
  }
});

/**
 * DELETE /api/photos/:id
 * Delete a photo (owner only)
 */
router.delete('/api/photos/:id', async (req, res) => {
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

  const { id: photoId } = req.params;

  try {
    await deletePhoto(photoId, agentId, sql);
    res.status(204).send();
  } catch (error: any) {
    console.error('[Photos API] Delete photo error:', error);
    res.status(400).json({ error: error.message || 'Failed to delete photo' });
  }
});

export default router;
