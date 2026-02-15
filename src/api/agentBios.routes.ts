import { Router } from 'express';
import { z } from 'zod';
import {
  getBio,
  setBio,
  updateSocialLinks,
  setSkills,
} from '../services/agentBios.js';
import { validateToken } from '../services/auth.js';
import { sql } from '../db/index.js';

const router = Router();

const updateBioSchema = z.object({
  bio: z.string().max(1000),
});

const updateLinksSchema = z.object({
  website: z.string().url().optional().or(z.literal('')),
  github: z.string().url().optional().or(z.literal('')),
  twitter: z.string().url().optional().or(z.literal('')),
  discord: z.string().url().optional().or(z.literal('')),
});

const updateSkillsSchema = z.object({
  skills: z.array(z.string().max(30)).max(10),
});

/**
 * GET /api/bios/:agentId
 * Get agent bio (public)
 */
router.get('/api/bios/:agentId', async (req, res) => {
  const { agentId } = req.params;

  try {
    const bio = await getBio(agentId, sql);
    res.status(200).json(bio);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch bio';
    res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/bios
 * Update my bio (requires auth)
 */
router.put('/api/bios', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { agentId } = validateToken(token);

  const parsed = updateBioSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error });
    return;
  }

  try {
    const bio = await setBio(agentId, parsed.data.bio, sql);
    res.status(200).json(bio);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update bio';
    res.status(400).json({ error: message });
  }
});

/**
 * PUT /api/bios/links
 * Update social links (requires auth)
 */
router.put('/api/bios/links', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { agentId } = validateToken(token);

  const parsed = updateLinksSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error });
    return;
  }

  try {
    const bio = await updateSocialLinks(agentId, parsed.data, sql);
    res.status(200).json(bio);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update links';
    res.status(400).json({ error: message });
  }
});

/**
 * PUT /api/bios/skills
 * Update skills (requires auth)
 */
router.put('/api/bios/skills', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { agentId } = validateToken(token);

  const parsed = updateSkillsSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error });
    return;
  }

  try {
    const bio = await setSkills(agentId, parsed.data.skills, sql);
    res.status(200).json(bio);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update skills';
    res.status(400).json({ error: message });
  }
});

export default router;
