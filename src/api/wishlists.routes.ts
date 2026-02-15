import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as wishlistsService from '../services/wishlists.js';

const router = express.Router();

const authCheck = (req: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized');
  const { agentId } = validateToken(token);
  if (agentId !== req.params.agentId) throw new Error('Forbidden');
  return agentId;
};

const handleError = (res: any, error: any) => {
  const status = error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : error.message.includes('full') ? 400 : 500;
  res.status(status).json({ error: error.message || 'Failed' });
};

router.post('/api/agents/:agentId/wishlist', async (req, res) => {
  try {
    const agentId = authCheck(req);
    const { itemName, itemType, priority, maxPrice, notes } = req.body;
    const item = await wishlistsService.addItem(agentId, itemName, itemType, priority || 'medium', maxPrice || null, notes || null, sql);
    res.json({ success: true, item });
  } catch (error: any) { handleError(res, error); }
});

router.delete('/api/agents/:agentId/wishlist/:id', async (req, res) => {
  try {
    const removed = await wishlistsService.removeItem(authCheck(req), parseInt(req.params.id), sql);
    res.json({ success: removed });
  } catch (error: any) { handleError(res, error); }
});

router.get('/api/agents/:agentId/wishlist', async (req, res) => {
  try {
    const filters = { type: req.query.type as any, priority: req.query.priority as any,
      fulfilled: req.query.fulfilled === 'true' ? true : req.query.fulfilled === 'false' ? false : undefined };
    const items = await wishlistsService.getWishlist(authCheck(req), filters, sql);
    res.json({ items });
  } catch (error: any) { handleError(res, error); }
});

router.put('/api/agents/:agentId/wishlist/:id/fulfill', async (req, res) => {
  try {
    const item = await wishlistsService.fulfillItem(authCheck(req), parseInt(req.params.id), sql);
    res.json({ success: !!item, item });
  } catch (error: any) { handleError(res, error); }
});

router.get('/api/wishlists/popular', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    res.json({ items: await wishlistsService.getPopularItems(limit, sql) });
  } catch (error: any) { res.status(500).json({ error: 'Failed' }); }
});

router.get('/api/agents/:agentId/wishlist/matches', async (req, res) => {
  try {
    res.json({ matches: await wishlistsService.matchWishlist(authCheck(req), sql) });
  } catch (error: any) { handleError(res, error); }
});

router.get('/api/agents/:agentId/wishlist/stats', async (req, res) => {
  try {
    res.json({ stats: await wishlistsService.getWishlistStats(authCheck(req), sql) });
  } catch (error: any) { handleError(res, error); }
});

export default router;
