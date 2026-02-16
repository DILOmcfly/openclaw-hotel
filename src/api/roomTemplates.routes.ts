/**
 * Room Templates API Routes
 * Endpoints for browsing and creating rooms from templates
 */

import express, { Request, Response } from 'express';
import { sql } from '../db/index.js';
import { validateToken } from '../services/auth.js';
import * as templateService from '../services/roomTemplates.js';

const router = express.Router();

/**
 * GET /api/templates
 * List all templates, optionally filtered by category
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const templates = await templateService.getTemplates(category, sql);
    
    res.json({ templates });
  } catch (error: any) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/**
 * GET /api/templates/:id
 * Get template details by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const templateId = req.params.id as string;
    const template = await templateService.getTemplateById(templateId, sql);
    
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
 * POST /api/templates/use/:id
 * Create a room from a template (requires authentication)
 */
router.post('/use/:id', validateToken, async (req: Request, res: Response) => {
  try {
    const templateId = req.params.id as string;
    const { roomName } = req.body;
    
    if (!roomName) {
      return res.status(400).json({ error: 'Room name is required' });
    }
    
    const agentId = (req as any).agentId; // Set by validateToken middleware
    
    const roomId = await templateService.createFromTemplate(
      templateId,
      agentId,
      roomName,
      sql
    );
    
    res.status(201).json({
      success: true,
      roomId,
      message: 'Room created from template successfully'
    });
  } catch (error: any) {
    console.error('Create from template error:', error);
    res.status(500).json({ error: error.message || 'Failed to create room from template' });
  }
});

/**
 * POST /api/templates
 * Create a custom template (requires authentication)
 */
router.post('/', validateToken, async (req: Request, res: Response) => {
  try {
    const { name, description, category, heightmap, furnitureLayout } = req.body;
    
    if (!name || !heightmap || !category) {
      return res.status(400).json({ 
        error: 'Name, category, and heightmap are required' 
      });
    }
    
    const agentId = (req as any).agentId;
    
    const templateId = await templateService.createTemplate(
      name,
      description || '',
      category,
      heightmap,
      furnitureLayout || [],
      agentId,
      sql
    );
    
    res.status(201).json({
      success: true,
      templateId,
      message: 'Template created successfully'
    });
  } catch (error: any) {
    console.error('Create template error:', error);
    res.status(500).json({ error: error.message || 'Failed to create template' });
  }
});

export default router;
