import { Router } from 'express';
import { z } from 'zod';
import { synthesizeSpeech, getVoiceForArchetype, sanitizeText } from '../services/tts.js';
import { sql } from '../db/index.js';
import { existsSync } from 'fs';
import { join } from 'path';

const router = Router();

const TTS_CACHE_DIR = '/tmp/openclaw-tts-cache';

const synthesizeSchema = z.object({
  text: z.string().min(1).max(500),
  agentId: z.string().uuid(),
});

/**
 * POST /api/tts/synthesize
 * Generate TTS audio for agent message
 */
router.post('/api/tts/synthesize', async (req, res) => {
  const parsed = synthesizeSchema.safeParse(req.body);
  
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error });
    return;
  }
  
  const { text, agentId } = parsed.data;
  
  try {
    // Fetch agent's personality archetype
    const agents = await sql`
      SELECT 
        a.id,
        p.archetype
      FROM agents a
      LEFT JOIN agent_personality p ON a.id = p.agent_id
      WHERE a.id = ${agentId}::uuid
      LIMIT 1
    `;
    
    if (agents.length === 0) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    
    const archetype = agents[0].archetype as string | null;
    const voiceId = getVoiceForArchetype(archetype);
    
    // Synthesize speech
    const { cacheKey } = await synthesizeSpeech(text, voiceId, agentId);
    
    // Return audio URL
    const audioUrl = `/api/tts/audio/${cacheKey}.aiff`;
    
    res.status(200).json({
      success: true,
      audioUrl,
      voiceId,
      archetype,
      sanitizedText: sanitizeText(text),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TTS synthesis failed';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/tts/audio/:filename
 * Serve TTS audio file from cache
 */
router.get('/api/tts/audio/:filename', (req, res) => {
  const { filename } = req.params;
  
  // Validate filename (only alphanumeric + .aiff)
  if (!/^[a-f0-9]+\.aiff$/i.test(filename)) {
    res.status(400).json({ error: 'Invalid filename format' });
    return;
  }
  
  const audioPath = join(TTS_CACHE_DIR, filename);
  
  // Check if file exists
  if (!existsSync(audioPath)) {
    res.status(404).json({ error: 'Audio file not found' });
    return;
  }
  
  // Serve audio file
  res.setHeader('Content-Type', 'audio/aiff');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
  res.sendFile(audioPath);
});

export default router;
