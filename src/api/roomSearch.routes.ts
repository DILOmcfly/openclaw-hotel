import { Router } from 'express';
import { z } from 'zod';
import { addTag, removeTag, getTagsByRoom, getPopularTags, setDescription, getDescription, searchRooms } from '../services/roomSearch.js';
import { sql } from '../db/index.js';

const router = Router();
const addTagSchema = z.object({ tag: z.string().min(1).max(20), createdBy: z.string() });
const setDescriptionSchema = z.object({
  shortDesc: z.string().max(200).default(''),
  longDesc: z.string().max(2000).default(''),
  rules: z.string().max(500).default(''),
});

router.post('/api/rooms/:roomId/tags', async (req, res) => {
  const { roomId } = req.params;
  const parsed = addTagSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error });
    return;
  }
  try {
    const result = await addTag(roomId, parsed.data.tag, parsed.data.createdBy, sql);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ success: true, tag: parsed.data.tag });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to add tag' });
  }
});

router.delete('/api/rooms/:roomId/tags/:tag', async (req, res) => {
  try {
    const result = await removeTag(req.params.roomId, req.params.tag, sql);
    if (!result.success) {
      res.status(500).json({ error: 'Failed to remove tag' });
      return;
    }
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to remove tag' });
  }
});

router.get('/api/rooms/:roomId/tags', async (req, res) => {
  try {
    const tags = await getTagsByRoom(req.params.roomId, sql);
    res.status(200).json(tags);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch tags' });
  }
});

router.get('/api/search/rooms', async (req, res) => {
  const query = req.query.q as string;
  if (!query || query.length === 0) {
    res.status(400).json({ error: 'Query parameter "q" is required' });
    return;
  }
  try {
    const results = await searchRooms(query, sql);
    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to search rooms' });
  }
});

router.get('/api/search/tags', async (req, res) => {
  const limit = parseInt(req.query.limit as string, 10) || 20;
  if (limit < 1 || limit > 100) {
    res.status(400).json({ error: 'Limit must be between 1 and 100' });
    return;
  }
  try {
    const tags = await getPopularTags(limit, sql);
    res.status(200).json(tags);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch popular tags' });
  }
});

router.put('/api/rooms/:roomId/description', async (req, res) => {
  const { roomId } = req.params;
  const parsed = setDescriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error });
    return;
  }
  try {
    const result = await setDescription(roomId, parsed.data.shortDesc, parsed.data.longDesc, parsed.data.rules, sql);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to set description' });
  }
});

router.get('/api/rooms/:roomId/description', async (req, res) => {
  try {
    const description = await getDescription(req.params.roomId, sql);
    if (!description) {
      res.status(404).json({ error: 'Description not found' });
      return;
    }
    res.status(200).json(description);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch description' });
  }
});

export default router;
