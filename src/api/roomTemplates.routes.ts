/**
 * Room Templates API Routes
 * Endpoints for browsing and creating rooms from pre-built templates
 */
import express, { Request, Response } from 'express';
import { validateToken } from '../services/auth.js';
import { requireRole } from '../middleware/admin.js';
import * as roomTemplateService from '../services/roomTemplates.js';
import { sql } from '../db/index.js';

const router = express.Router();

/**
 * GET /api/room-templates
 * Get all available room templates
 * Query params: category, includePremium
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const includePremium = req.query.includePremium === 'true';

    const templates = await roomTemplateService.getAllTemplates(category, includePremium);
    res.json({ templates });
  } catch (error: any) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/**
 * GET /api/room-templates/popular
 * Get most popular templates (by use_count)
 * Query params: limit (default: 10)
 */
router.get('/popular', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string || '10', 10);
    const templates = await roomTemplateService.getPopularTemplates(limit);

    res.json({ templates });
  } catch (error: any) {
    console.error('Get popular templates error:', error);
    res.status(500).json({ error: 'Failed to fetch popular templates' });
  }
});

/**
 * GET /api/room-templates/search
 * Search templates by name or description
 * Query params: q (query string)
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const templates = await roomTemplateService.searchTemplates(query);
    res.json({ templates });
  } catch (error: any) {
    console.error('Search templates error:', error);
    res.status(500).json({ error: 'Failed to search templates' });
  }
});

/**
 * GET /api/room-templates/:id
 * Get a single template by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const template = await roomTemplateService.getTemplateById(req.params.id as string);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template });
  } catch (error: any) {
    console.error('Get template error:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

/**
 * POST /api/room-templates/create
 * Create a new room from a template
 * Body: { templateId: string, roomName?: string }
 * Headers: Authorization (JWT)
 */
router.post('/create', validateToken, async (req: Request, res: Response) => {
  try {
    const { templateId, roomName } = req.body;
    if (!templateId) {
      return res.status(400).json({ error: 'Template ID required' });
    }

    const agentId = (req as any).agentId; // From validateToken middleware

    const roomId = await roomTemplateService.createRoomFromTemplate({
      templateId,
      ownerId: agentId,
      roomName,
    });

    res.status(201).json({ 
      success: true, 
      roomId,
      message: 'Room created from template successfully' 
    });
  } catch (error: any) {
    console.error('Create room from template error:', error);
    res.status(500).json({ error: error.message || 'Failed to create room from template' });
  }
});

/**
 * POST /api/room-templates/save
 * Save current room as a custom template
 * Body: { roomId: string, templateName: string, description?: string, isPrivate?: boolean }
 * Headers: Authorization (JWT)
 */
router.post('/save', validateToken, async (req: Request, res: Response) => {
  try {
    const { roomId, templateName, description, isPrivate } = req.body;
    if (!roomId || !templateName) {
      return res.status(400).json({ error: 'Room ID and template name required' });
    }

    const agentId = (req as any).agentId;

    // Ownership verification
    const rooms = await sql`SELECT owner_id FROM rooms WHERE id = ${roomId}`;
    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (rooms[0].owner_id !== agentId) {
      return res.status(403).json({ error: 'Only room owner can save as template' });
    }

    const templateId = await roomTemplateService.saveRoomAsTemplate(
      roomId,
      templateName,
      description,
      isPrivate || false
    );

    res.status(201).json({ 
      success: true, 
      templateId,
      message: 'Room saved as template successfully' 
    });
  } catch (error: any) {
    console.error('Save room as template error:', error);
    res.status(500).json({ error: error.message || 'Failed to save room as template' });
  }
});

/**
 * DELETE /api/room-templates/:id
 * Delete a custom template (admin only)
 * Headers: Authorization (JWT)
 */
router.delete('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const deleted = await roomTemplateService.deleteTemplate(req.params.id as string);
    if (!deleted) {
      return res.status(404).json({ error: 'Template not found or not deletable' });
    }

    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error: any) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
