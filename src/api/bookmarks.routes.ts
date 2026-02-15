import express from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as svc from '../services/bookmarks.js';

const router = express.Router();
const auth = (req: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized');
  const { agentId } = validateToken(token);
  if (agentId !== req.params.agentId) throw new Error('Forbidden');
  return agentId;
};
const errCode = (msg: string) => msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500;

router.post('/api/agents/:agentId/bookmarks', async (req, res) => {
  try {
    const { bookmarkType, targetId, note, folder } = req.body;
    if (!svc.isValidBookmarkType(bookmarkType)) return res.status(400).json({ error: 'Invalid bookmark type' });
    const bookmark = await svc.addBookmark(auth(req), bookmarkType, targetId, note || null, folder || 'default', sql);
    res.status(201).json({ success: true, bookmark });
  } catch (e: any) { res.status(errCode(e.message)).json({ error: e.message || 'Failed to add bookmark' }); }
});

router.delete('/api/agents/:agentId/bookmarks/:id', async (req, res) => {
  try {
    res.json({ success: await svc.removeBookmark(auth(req), parseInt(req.params.id), sql) });
  } catch (e: any) { res.status(errCode(e.message)).json({ error: 'Failed to remove bookmark' }); }
});

router.get('/api/agents/:agentId/bookmarks', async (req, res) => {
  try {
    const type = req.query.type as string | undefined;
    const bookmarks = await svc.getBookmarks(auth(req), type && svc.isValidBookmarkType(type) ? type : null, req.query.folder as string || null, sql);
    res.json({ bookmarks });
  } catch (e: any) { res.status(errCode(e.message)).json({ error: 'Failed to fetch bookmarks' }); }
});

router.get('/api/agents/:agentId/bookmarks/folders', async (req, res) => {
  try {
    res.json({ folders: await svc.getFolders(auth(req), sql) });
  } catch (e: any) { res.status(errCode(e.message)).json({ error: 'Failed to fetch folders' }); }
});

router.put('/api/agents/:agentId/bookmarks/:id/folder', async (req, res) => {
  try {
    res.json({ success: await svc.moveToFolder(auth(req), parseInt(req.params.id), req.body.folder, sql) });
  } catch (e: any) { res.status(errCode(e.message)).json({ error: 'Failed to move bookmark' }); }
});

router.get('/api/agents/:agentId/bookmarks/search', async (req, res) => {
  try {
    res.json({ bookmarks: await svc.searchBookmarks(auth(req), req.query.q as string || '', sql) });
  } catch (e: any) { res.status(errCode(e.message)).json({ error: 'Failed to search bookmarks' }); }
});

router.get('/api/agents/:agentId/bookmarks/check/:type/:targetId', async (req, res) => {
  try {
    const { type, targetId } = req.params;
    if (!svc.isValidBookmarkType(type)) return res.status(400).json({ error: 'Invalid bookmark type' });
    res.json({ bookmarked: await svc.isBookmarked(auth(req), type, targetId, sql) });
  } catch (e: any) { res.status(errCode(e.message)).json({ error: 'Failed to check bookmark' }); }
});

export default router;
