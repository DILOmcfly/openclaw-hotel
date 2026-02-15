import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as roomShopsService from '../services/roomShops.js';

const router = express.Router();

// POST /api/rooms/:roomId/shop - Create shop
router.post('/api/rooms/:roomId/shop', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const roomId = parseInt(req.params.roomId);
    const { shopName, description } = req.body;
    const shop = await roomShopsService.createShop(roomId, shopName, description, sql);
    res.json(shop);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create shop' });
  }
});

// PUT /api/rooms/:roomId/shop - Update shop
router.put('/api/rooms/:roomId/shop', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const roomId = parseInt(req.params.roomId);
    const shop = await roomShopsService.updateShop(roomId, req.body, sql);
    res.json(shop);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update shop' });
  }
});

// POST /api/rooms/:roomId/shop/items - List item
router.post('/api/rooms/:roomId/shop/items', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const roomId = parseInt(req.params.roomId);
    const { itemName, price, stock } = req.body;
    const item = await roomShopsService.listItem(roomId, itemName, price, stock, sql);
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list item' });
  }
});

// DELETE /api/rooms/:roomId/shop/items/:itemId - Unlist item
router.delete('/api/rooms/:roomId/shop/items/:itemId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const roomId = parseInt(req.params.roomId);
    const itemId = parseInt(req.params.itemId);
    await roomShopsService.unlistItem(itemId, roomId, sql);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to unlist item' });
  }
});

// GET /api/rooms/:roomId/shop/items - Get shop items
router.get('/api/rooms/:roomId/shop/items', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const items = await roomShopsService.getShopItems(roomId, sql);
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// POST /api/rooms/:roomId/shop/items/:itemId/buy - Purchase item
router.post('/api/rooms/:roomId/shop/items/:itemId/buy', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { agentId } = validateToken(token);
    const itemId = parseInt(req.params.itemId);
    const result = await roomShopsService.purchaseItem(itemId, agentId, sql);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to purchase item' });
  }
});

// GET /api/rooms/:roomId/shop/stats - Get shop stats
router.get('/api/rooms/:roomId/shop/stats', async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const stats = await roomShopsService.getShopStats(roomId, sql);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/shops/popular - Get popular shops
router.get('/api/shops/popular', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const shops = await roomShopsService.getPopularShops(limit, sql);
    res.json(shops);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch popular shops' });
  }
});

export default router;
