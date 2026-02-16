import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as themeSvc from '../services/roomThemes.js';

const router = express.Router();

router.get('/api/themes', async (req, res) => {
  try { res.json({ themes: await themeSvc.getAllThemes(sql) }); }
  catch { res.status(500).json({ error: 'Failed to fetch themes' }); }
});

router.get('/api/themes/:id', async (req, res) => {
  try {
    const theme = await themeSvc.getThemeById(parseInt(req.params.id), sql);
    theme ? res.json({ theme }) : res.status(404).json({ error: 'Theme not found' });
  } catch { res.status(500).json({ error: 'Failed to fetch theme' }); }
});

router.post('/api/rooms/:roomId/theme/:themeId', validateToken, async (req: express.Request, res: express.Response) => {
  try {
    const roomId = req.params.roomId as string;
    const themeId = req.params.themeId as string;
    const result = await themeSvc.applyTheme(
      parseInt(roomId), parseInt(themeId), (req as any).agentId, sql
    );
    result.success ? res.json({ success: true, settings: result.settings }) 
                   : res.status(400).json({ error: result.error });
  } catch { res.status(500).json({ error: 'Failed to apply theme' }); }
});

router.delete('/api/rooms/:roomId/theme', async (req, res) => {
  try {
    const removed = await themeSvc.removeTheme(parseInt(req.params.roomId), sql);
    removed ? res.json({ success: true }) 
            : res.status(404).json({ error: 'No theme applied to this room' });
  } catch { res.status(500).json({ error: 'Failed to remove theme' }); }
});

router.get('/api/rooms/:roomId/theme', async (req, res) => {
  try {
    const appliedTheme = await themeSvc.getAppliedTheme(parseInt(req.params.roomId), sql);
    appliedTheme ? res.json({ appliedTheme }) 
                 : res.status(404).json({ error: 'No theme applied to this room' });
  } catch { res.status(500).json({ error: 'Failed to fetch applied theme' }); }
});

router.get('/api/themes/category/:category', async (req, res) => {
  try { res.json({ themes: await themeSvc.getThemesByCategory(req.params.category, sql) }); }
  catch { res.status(500).json({ error: 'Failed to fetch themes by category' }); }
});

router.get('/api/themes/popular', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    res.json({ themes: await themeSvc.getPopularThemes(limit, sql) });
  } catch { res.status(500).json({ error: 'Failed to fetch popular themes' }); }
});

router.get('/api/themes/:id/preview', async (req, res) => {
  try {
    const settings = await themeSvc.previewTheme(parseInt(req.params.id), sql);
    settings ? res.json({ settings }) : res.status(404).json({ error: 'Theme not found' });
  } catch { res.status(500).json({ error: 'Failed to preview theme' }); }
});

export default router;
