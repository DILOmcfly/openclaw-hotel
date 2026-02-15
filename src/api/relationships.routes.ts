import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import { logger } from '../utils/logger.js';
import {
  setRelationship,
  removeRelationship,
  getRelationships,
  getRelationshipBetween,
  type RelationshipType,
} from '../services/relationships.js';

const router = express.Router();
const validTypes: RelationshipType[] = ['rival', 'partner', 'mentor', 'mentee', 'blocked'];

router.post('/api/relationships', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const { targetId, type } = req.body;

    if (!targetId || !type) {
      return res.status(400).json({ error: 'targetId and type are required' });
    }
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid relationship type' });
    }

    const relationship = await setRelationship(agentId, targetId, type, sql);
    logger.info('Relationship set', { agentId, targetId, type, relationshipId: relationship.id });
    res.json({ success: true, relationship });
  } catch (error: any) {
    logger.error('Failed to set relationship', { error });
    res.status(400).json({ error: error.message || 'Failed to set relationship' });
  }
});

router.delete('/api/relationships/:targetId/:type', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const { targetId, type } = req.params;

    if (!validTypes.includes(type as RelationshipType)) {
      return res.status(400).json({ error: 'Invalid relationship type' });
    }

    await removeRelationship(agentId, targetId, type as RelationshipType, sql);
    logger.info('Relationship removed', { agentId, targetId, type });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to remove relationship', { error });
    res.status(400).json({ error: error.message || 'Failed to remove relationship' });
  }
});

router.get('/api/relationships', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const { type } = req.query;

    if (type && !validTypes.includes(type as RelationshipType)) {
      return res.status(400).json({ error: 'Invalid relationship type' });
    }

    const relationships = await getRelationships(agentId, type as RelationshipType | undefined, sql);
    res.json({ relationships });
  } catch (error: any) {
    logger.error('Failed to fetch relationships', { error });
    res.status(500).json({ error: 'Failed to fetch relationships' });
  }
});

router.get('/api/relationships/:targetId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const { targetId } = req.params;

    const relationships = await getRelationshipBetween(agentId, targetId, sql);
    res.json({ relationships });
  } catch (error: any) {
    logger.error('Failed to fetch relationship', { error });
    res.status(500).json({ error: 'Failed to fetch relationship' });
  }
});

router.post('/api/relationships/:targetId/block', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const { targetId } = req.params;

    const relationship = await setRelationship(agentId, targetId, 'blocked', sql);
    logger.info('Agent blocked', { agentId, targetId, relationshipId: relationship.id });
    res.json({ success: true, relationship });
  } catch (error: any) {
    logger.error('Failed to block agent', { error });
    res.status(400).json({ error: error.message || 'Failed to block agent' });
  }
});

export default router;
