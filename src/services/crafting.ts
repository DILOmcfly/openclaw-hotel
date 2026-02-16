/**
 * Crafting Service - Manages recipe crafting system
 */

export type Recipe = {
  id: number;
  name: string;
  resultItemName: string;
  resultRarity: string;
  craftTimeSeconds: number;
  ingredients: RecipeIngredient[];
};

export type RecipeIngredient = {
  itemName: string;
  quantity: number;
};

export type CraftQueueEntry = {
  id: number;
  agentId: string;
  recipeId: number;
  recipeName?: string;
  startedAt: Date;
  completesAt: Date | null;
  completed: boolean;
};

/**
 * Get all available recipes
 * OPTIMIZED: Single JOIN query instead of N+1 pattern
 */
export async function getRecipes(sql: any): Promise<Recipe[]> {
  const result = await sql`
    SELECT 
      r.id, r.name, 
      r.result_item_name AS "resultItemName",
      r.result_rarity AS "resultRarity", 
      r.craft_time_seconds AS "craftTimeSeconds",
      COALESCE(
        json_agg(
          json_build_object('itemName', ri.item_name, 'quantity', ri.quantity)
          ORDER BY ri.item_name
        ) FILTER (WHERE ri.item_name IS NOT NULL),
        '[]'
      ) AS ingredients
    FROM recipes r
    LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
    GROUP BY r.id, r.name, r.result_item_name, r.result_rarity, r.craft_time_seconds
    ORDER BY r.craft_time_seconds ASC, r.name ASC
  `;

  return result.map((row: any) => ({
    ...row,
    ingredients: row.ingredients
  }));
}

/**
 * Get recipe by ID
 */
export async function getRecipeById(recipeId: number, sql: any): Promise<Recipe | null> {
  const result = await sql`
    SELECT id, name, result_item_name AS "resultItemName",
           result_rarity AS "resultRarity", craft_time_seconds AS "craftTimeSeconds"
    FROM recipes WHERE id = ${recipeId}
  `;

  if (result.length === 0) return null;

  const ingredients = await sql`
    SELECT item_name AS "itemName", quantity
    FROM recipe_ingredients WHERE recipe_id = ${recipeId}
  `;

  return { ...result[0], ingredients };
}

/**
 * Start crafting an item
 */
export async function startCraft(agentId: string, recipeId: number, sql: any): Promise<CraftQueueEntry> {
  const recipe = await getRecipeById(recipeId, sql);
  if (!recipe) throw new Error('Recipe not found');

  const startedAt = new Date();
  const completesAt = new Date(startedAt.getTime() + recipe.craftTimeSeconds * 1000);

  const result = await sql`
    INSERT INTO craft_queue (agent_id, recipe_id, started_at, completes_at, completed)
    VALUES (${agentId}, ${recipeId}, ${startedAt}, ${completesAt}, false)
    RETURNING id, agent_id AS "agentId", recipe_id AS "recipeId",
              started_at AS "startedAt", completes_at AS "completesAt", completed
  `;

  return result[0];
}

/**
 * Complete a craft if time has elapsed
 */
export async function completeCraft(craftId: number, agentId: string, sql: any): Promise<{ success: boolean; message: string; item?: string }> {
  const craft = await sql`
    SELECT id, agent_id AS "agentId", recipe_id AS "recipeId",
           started_at AS "startedAt", completes_at AS "completesAt", completed
    FROM craft_queue WHERE id = ${craftId} AND agent_id = ${agentId}
  `;

  if (craft.length === 0) return { success: false, message: 'Craft not found' };

  const entry = craft[0];
  if (entry.completed) return { success: false, message: 'Craft already completed' };

  const now = new Date();
  if (entry.completesAt && now < new Date(entry.completesAt)) {
    const remaining = Math.ceil((new Date(entry.completesAt).getTime() - now.getTime()) / 1000);
    return { success: false, message: `Craft not ready. ${remaining}s remaining` };
  }

  await sql`UPDATE craft_queue SET completed = true WHERE id = ${craftId}`;

  const recipe = await getRecipeById(entry.recipeId, sql);
  return { success: true, message: 'Craft completed', item: recipe?.resultItemName };
}

/**
 * Get agent's craft queue
 */
export async function getCraftQueue(agentId: string, sql: any): Promise<CraftQueueEntry[]> {
  return sql`
    SELECT cq.id, cq.agent_id AS "agentId", cq.recipe_id AS "recipeId", r.name AS "recipeName",
           cq.started_at AS "startedAt", cq.completes_at AS "completesAt", cq.completed
    FROM craft_queue cq JOIN recipes r ON cq.recipe_id = r.id
    WHERE cq.agent_id = ${agentId} ORDER BY cq.started_at DESC LIMIT 50
  `;
}

/**
 * Cancel a pending craft
 */
export async function cancelCraft(craftId: number, agentId: string, sql: any): Promise<boolean> {
  const result = await sql`
    DELETE FROM craft_queue
    WHERE id = ${craftId} AND agent_id = ${agentId} AND completed = false
    RETURNING id
  `;
  return result.length > 0;
}
