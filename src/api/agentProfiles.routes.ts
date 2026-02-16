import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as profilesService from '../services/agentProfiles.js';

const router = express.Router();

// Helper to parse pagination params
function getPaginationParams(query: any): { limit: number; offset: number } {
  const limit = Math.min(parseInt(query.limit) || 50, 100); // Max 100
  const offset = Math.max(parseInt(query.offset) || 0, 0); // Min 0
  return { limit, offset };
}

router.get('/api/agents/:agentId/profile', async (req, res) => {
  try {
    const { agentId } = req.params;
    let viewerId: string | null = null;
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        viewerId = validateToken(token).agentId;
      } catch {}
    }
    const profile = await profilesService.getProfile(agentId, viewerId, sql);
    res.json(profile);
  } catch (error) {
    console.error('[Agent Profiles API] Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/api/agents/:agentId/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId: tokenAgentId } = validateToken(token);
    const { agentId } = req.params;
    if (tokenAgentId !== agentId) {
      return res.status(403).json({ error: 'Can only update own profile' });
    }

    const profile = await profilesService.updateProfile(agentId, req.body, sql);
    res.json(profile);
  } catch (error: any) {
    console.error('[Agent Profiles API] Error updating profile:', error);
    if (error.message?.includes('exceeds maximum length') || error.message?.includes('Invalid')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.get('/api/profiles/top-viewed', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const profiles = await profilesService.getTopViewed(limit, sql);
    res.json({ profiles });
  } catch (error) {
    console.error('[Agent Profiles API] Error fetching top profiles:', error);
    res.status(500).json({ error: 'Failed to fetch top profiles' });
  }
});

router.get('/api/profiles/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) return res.status(400).json({ error: 'Search query required' });
    
    const { limit, offset } = getPaginationParams(req.query);
    
    // Get total count and results
    const [total, profiles] = await Promise.all([
      profilesService.getSearchCount(query, sql),
      profilesService.searchProfiles(query, limit, offset, sql)
    ]);
    
    res.json({
      profiles,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    console.error('[Agent Profiles API] Error searching profiles:', error);
    res.status(500).json({ error: 'Failed to search profiles' });
  }
});

router.get('/api/profiles/online', async (req, res) => {
  try {
    const { limit, offset } = getPaginationParams(req.query);
    
    // Get total count and results
    const [total, profiles] = await Promise.all([
      profilesService.getOnlineCount(sql),
      profilesService.getOnlineProfiles(limit, offset, sql)
    ]);
    
    res.json({
      profiles,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    console.error('[Agent Profiles API] Error fetching online profiles:', error);
    res.status(500).json({ error: 'Failed to fetch online profiles' });
  }
});

router.get('/api/agents/:agentId/profile/stats', async (req, res) => {
  try {
    const { agentId } = req.params;
    const stats = await profilesService.getProfileStats(agentId, sql);
    res.json(stats);
  } catch (error) {
    console.error('[Agent Profiles API] Error fetching profile stats:', error);
    res.status(500).json({ error: 'Failed to fetch profile stats' });
  }
});

export default router;
