import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as auctionsService from '../services/auctions.js';

const router = express.Router();

router.post('/api/auctions', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const { itemName, itemRarity, startingPrice, durationHours } = req.body;
    const auction = await auctionsService.createAuction(
      agentId, itemName, itemRarity || 'common', startingPrice || 1, durationHours || 24, sql
    );
    res.status(201).json({ success: true, auction });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create auction' });
  }
});

router.post('/api/auctions/:id/bid', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const auction = await auctionsService.placeBid(parseInt(req.params.id), agentId, req.body.amount, sql);
    res.json({ success: true, auction });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to place bid' });
  }
});

router.get('/api/auctions', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const sortBy = (req.query.sortBy as any) || 'ending_soon';
    const auctions = await auctionsService.getActiveAuctions(limit, offset, sortBy, sql);
    res.json({ auctions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch auctions' });
  }
});

router.get('/api/auctions/:id', async (req, res) => {
  try {
    const auctionId = parseInt(req.params.id);
    const auction = await auctionsService.getAuctionById(auctionId, sql);
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    const bidHistory = await auctionsService.getAuctionBidHistory(auctionId, sql);
    res.json({ auction, bidHistory });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch auction' });
  }
});

router.delete('/api/auctions/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { agentId } = validateToken(token);
    const auction = await auctionsService.cancelAuction(parseInt(req.params.id), agentId, sql);
    res.json({ success: true, auction });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to cancel auction' });
  }
});

router.post('/api/auctions/expire', async (req, res) => {
  try {
    const expiredCount = await auctionsService.expireAuctions(sql);
    res.json({ success: true, expiredCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to expire auctions' });
  }
});

router.get('/api/agents/:agentId/auctions', async (req, res) => {
  try {
    const auctions = await auctionsService.getAgentAuctions(req.params.agentId, sql);
    res.json({ auctions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch agent auctions' });
  }
});

export default router;
