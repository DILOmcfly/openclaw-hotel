import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as playlistsService from '../services/roomPlaylists.js';

const router = express.Router();

router.post('/api/rooms/:roomId/playlist', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    validateToken(token);
    const playlist = await playlistsService.createPlaylist(parseInt(req.params.roomId), req.body.name || 'Room Playlist', sql);
    res.json({ success: true, playlist });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

router.post('/api/rooms/:roomId/playlist/tracks', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const { playlistId, trackName, artist, durationSeconds } = req.body;
    const track = await playlistsService.addTrack(playlistId, trackName, artist || 'Unknown', durationSeconds || 180, agentId, sql);
    if (!track) return res.status(400).json({ error: 'Playlist full or not found' });
    res.json({ success: true, track });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add track' });
  }
});

router.delete('/api/rooms/:roomId/playlist/tracks/:trackId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const removed = await playlistsService.removeTrack(parseInt(req.params.trackId), agentId, req.body.roomOwnerId || agentId, sql);
    if (!removed) return res.status(403).json({ error: 'Not authorized or track not found' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove track' });
  }
});

router.get('/api/rooms/:roomId/playlist/tracks', async (req, res) => {
  try {
    const tracks = await playlistsService.getTracks(parseInt(req.query.playlistId as string), sql);
    res.json({ tracks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
});

router.post('/api/playlist/tracks/:trackId/vote', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const success = await playlistsService.voteTrack(parseInt(req.params.trackId), agentId, req.body.vote, sql);
    if (!success) return res.status(400).json({ error: 'Invalid vote' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to vote' });
  }
});

router.post('/api/rooms/:roomId/playlist/reorder', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    validateToken(token);
    await playlistsService.reorderByVotes(req.body.playlistId, sql);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reorder playlist' });
  }
});

router.get('/api/rooms/:roomId/playlist/stats', async (req, res) => {
  try {
    const stats = await playlistsService.getPlaylistStats(parseInt(req.query.playlistId as string), sql);
    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
