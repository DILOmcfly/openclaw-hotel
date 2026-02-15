import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as roomCodesService from '../services/roomCodes.js';

const router = express.Router();

const authMiddleware = (req: any, res: any): { agentId: string } | null => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  return validateToken(token);
};

router.post('/api/rooms/:roomId/codes', async (req, res) => {
  try {
    const auth = authMiddleware(req, res);
    if (!auth) return;
    const code = await roomCodesService.generateCode(parseInt(req.params.roomId), auth.agentId, sql, {
      maxUses: req.body.maxUses ? parseInt(req.body.maxUses) : undefined,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
    });
    res.json({ success: true, code });
  } catch (error: any) {
    res.status(error.message === 'Not room owner' ? 403 : 500).json({ error: error.message || 'Failed' });
  }
});

router.post('/api/rooms/:roomId/codes/validate', async (req, res) => {
  try {
    if (!req.body.code) return res.status(400).json({ error: 'Code required' });
    res.json(await roomCodesService.validateCode(parseInt(req.params.roomId), req.body.code, sql));
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/api/rooms/:roomId/codes/:codeId/use', async (req, res) => {
  try {
    if (!req.body.code) return res.status(400).json({ error: 'Code required' });
    await roomCodesService.useCode(parseInt(req.params.roomId), req.body.code, sql);
    res.json({ success: true });
  } catch (error: any) { res.status(400).json({ error: error.message || 'Failed' }); }
});

router.get('/api/rooms/:roomId/codes', async (req, res) => {
  try {
    const auth = authMiddleware(req, res);
    if (!auth) return;
    res.json({ codes: await roomCodesService.listCodes(parseInt(req.params.roomId), auth.agentId, sql) });
  } catch (error: any) {
    res.status(error.message === 'Not room owner' ? 403 : 500).json({ error: error.message || 'Failed' });
  }
});

router.delete('/api/rooms/:roomId/codes/:codeId', async (req, res) => {
  try {
    const auth = authMiddleware(req, res);
    if (!auth) return;
    await roomCodesService.revokeCode(parseInt(req.params.roomId), parseInt(req.params.codeId), auth.agentId, sql);
    res.json({ success: true });
  } catch (error: any) {
    res.status(error.message === 'Not room owner' ? 403 : 500).json({ error: error.message || 'Failed' });
  }
});

router.get('/api/rooms/:roomId/codes/stats', async (req, res) => {
  try {
    res.json(await roomCodesService.getCodeStats(parseInt(req.params.roomId), sql));
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

export default router;
