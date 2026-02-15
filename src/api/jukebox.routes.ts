import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as jukeboxService from '../services/jukebox.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/rooms/:roomId/jukebox
 * Get playlist state for a room
 */
router.get('/api/rooms/:roomId/jukebox', async (req, res) => {
  try {
    const { roomId } = req.params;

    const playlist = await jukeboxService.getPlaylist(roomId, sql);

    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    res.json(playlist);
  } catch (error) {
    logger.error('Error getting playlist', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/rooms/:roomId/jukebox/playlist
 * Set playlist for a room (room owner only)
 */
router.put('/api/rooms/:roomId/jukebox/playlist', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { roomId } = req.params;
    const { tracks } = req.body;

    if (!tracks || !Array.isArray(tracks)) {
      return res.status(400).json({ error: 'tracks array is required' });
    }

    // Validate track structure
    for (const track of tracks) {
      if (!track.title || !track.artist || !track.genre || typeof track.durationSecs !== 'number') {
        return res.status(400).json({ 
          error: 'Each track must have title, artist, genre, and durationSecs' 
        });
      }
    }

    // Check room ownership
    const room = await sql`
      SELECT created_by FROM rooms WHERE id = ${roomId}::uuid
    `;

    if (room.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room[0].created_by !== agentId) {
      return res.status(403).json({ error: 'Only room owner can set playlist' });
    }

    const playlist = await jukeboxService.setPlaylist(roomId, tracks, sql);

    res.json(playlist);
  } catch (error: any) {
    logger.error('Error setting playlist', { error });
    if (error.message?.includes('cannot exceed')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/rooms/:roomId/jukebox/track
 * Add a track to the playlist (room owner only)
 */
router.post('/api/rooms/:roomId/jukebox/track', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { roomId } = req.params;
    const { track } = req.body;

    if (!track || !track.title || !track.artist || !track.genre || typeof track.durationSecs !== 'number') {
      return res.status(400).json({ 
        error: 'track must have title, artist, genre, and durationSecs' 
      });
    }

    // Check room ownership
    const room = await sql`
      SELECT created_by FROM rooms WHERE id = ${roomId}::uuid
    `;

    if (room.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room[0].created_by !== agentId) {
      return res.status(403).json({ error: 'Only room owner can add tracks' });
    }

    const playlist = await jukeboxService.addTrack(roomId, track, sql);

    res.json(playlist);
  } catch (error: any) {
    logger.error('Error adding track', { error });
    if (error.message?.includes('cannot exceed')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/rooms/:roomId/jukebox/track/:index
 * Remove a track from the playlist
 */
router.delete('/api/rooms/:roomId/jukebox/track/:index', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { agentId } = validateToken(token);
    const { roomId, index } = req.params;
    const trackIndex = parseInt(index, 10);

    if (isNaN(trackIndex)) {
      return res.status(400).json({ error: 'Invalid track index' });
    }

    // Check room ownership
    const room = await sql`
      SELECT created_by FROM rooms WHERE id = ${roomId}::uuid
    `;

    if (room.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room[0].created_by !== agentId) {
      return res.status(403).json({ error: 'Only room owner can remove tracks' });
    }

    const playlist = await jukeboxService.removeTrack(roomId, trackIndex, sql);

    res.json(playlist);
  } catch (error: any) {
    logger.error('Error removing track', { error });
    if (error.message?.includes('not found') || error.message?.includes('Invalid')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/rooms/:roomId/jukebox/play
 * Start playing the playlist
 */
router.put('/api/rooms/:roomId/jukebox/play', async (req, res) => {
  try {
    const { roomId } = req.params;

    const playlist = await jukeboxService.play(roomId, sql);

    res.json(playlist);
  } catch (error: any) {
    logger.error('Error playing playlist', { error });
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/rooms/:roomId/jukebox/pause
 * Pause the playlist
 */
router.put('/api/rooms/:roomId/jukebox/pause', async (req, res) => {
  try {
    const { roomId } = req.params;

    const playlist = await jukeboxService.pause(roomId, sql);

    res.json(playlist);
  } catch (error: any) {
    logger.error('Error pausing playlist', { error });
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/rooms/:roomId/jukebox/next
 * Skip to next track
 */
router.put('/api/rooms/:roomId/jukebox/next', async (req, res) => {
  try {
    const { roomId } = req.params;

    const playlist = await jukeboxService.nextTrack(roomId, sql);

    res.json(playlist);
  } catch (error: any) {
    logger.error('Error skipping to next track', { error });
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/rooms/:roomId/jukebox/volume
 * Set volume
 */
router.put('/api/rooms/:roomId/jukebox/volume', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { volume } = req.body;

    if (typeof volume !== 'number') {
      return res.status(400).json({ error: 'volume must be a number' });
    }

    const playlist = await jukeboxService.setVolume(roomId, volume, sql);

    res.json(playlist);
  } catch (error: any) {
    logger.error('Error setting volume', { error });
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message?.includes('must be between')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
