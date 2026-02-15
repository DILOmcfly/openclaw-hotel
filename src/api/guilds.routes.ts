import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import { logger } from '../utils/logger.js';
import { createGuild, joinGuild, leaveGuild, promoteToOfficer, demoteToMember, getGuild, getMembers, disbandGuild } from '../services/guilds.js';

const router = express.Router();

router.post('/api/guilds', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const { name, description = '', tag, badgeIcon = '⚔️' } = req.body;
    if (!name || !tag) return res.status(400).json({ error: 'name and tag are required' });

    const guild = await createGuild(name, description, tag, badgeIcon, agentId, sql);
    logger.info('Guild created', { guildId: guild.id, name: guild.name, leaderId: agentId });
    res.json({ success: true, guild });
  } catch (error: any) {
    logger.error('Failed to create guild', { error });
    res.status(400).json({ error: error.message || 'Failed to create guild' });
  }
});

router.get('/api/guilds', async (req, res) => {
  try {
    // PERFORMANCE: Added LIMIT to prevent unbounded query
    // TODO: Implement pagination with limit/offset query params
    const guilds = await sql<any[]>`
      SELECT id, name, description, tag, badge_icon AS "badgeIcon", 
             leader_id AS "leaderId", member_count AS "memberCount", 
             created_at AS "createdAt" 
      FROM guilds 
      ORDER BY member_count DESC, created_at DESC
      LIMIT 200
    `;
    res.json({ guilds });
  } catch (error: any) {
    logger.error('Failed to fetch guilds', { error });
    res.status(500).json({ error: 'Failed to fetch guilds' });
  }
});

router.get('/api/guilds/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const guild = await getGuild(id, sql);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const members = await getMembers(id, sql);
    res.json({ guild, members });
  } catch (error: any) {
    logger.error('Failed to fetch guild', { error });
    res.status(500).json({ error: 'Failed to fetch guild' });
  }
});

router.post('/api/guilds/:id/join', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const { id } = req.params;

    await joinGuild(id, agentId, sql);
    logger.info('Agent joined guild', { guildId: id, agentId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to join guild', { error });
    res.status(400).json({ error: error.message || 'Failed to join guild' });
  }
});

router.delete('/api/guilds/:id/leave', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const { id } = req.params;

    await leaveGuild(id, agentId, sql);
    logger.info('Agent left guild', { guildId: id, agentId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to leave guild', { error });
    res.status(400).json({ error: error.message || 'Failed to leave guild' });
  }
});

router.put('/api/guilds/:id/promote/:agentId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId: leaderId } = validateToken(token);
    const { id, agentId } = req.params;

    await promoteToOfficer(id, agentId, leaderId, sql);
    logger.info('Member promoted to officer', { guildId: id, agentId, promotedBy: leaderId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to promote member', { error });
    res.status(400).json({ error: error.message || 'Failed to promote member' });
  }
});

router.put('/api/guilds/:id/demote/:agentId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId: leaderId } = validateToken(token);
    const { id, agentId } = req.params;

    await demoteToMember(id, agentId, leaderId, sql);
    logger.info('Officer demoted to member', { guildId: id, agentId, demotedBy: leaderId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to demote member', { error });
    res.status(400).json({ error: error.message || 'Failed to demote member' });
  }
});

router.delete('/api/guilds/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId: leaderId } = validateToken(token);
    const { id } = req.params;

    await disbandGuild(id, leaderId, sql);
    logger.info('Guild disbanded', { guildId: id, leaderId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to disband guild', { error });
    res.status(400).json({ error: error.message || 'Failed to disband guild' });
  }
});

export default router;
