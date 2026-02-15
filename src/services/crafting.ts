/**
 * Crafting Service - Agent item crafting system
 */

export type CraftingRecipe = {
  id: string;
  name: string;
  resultItem: string;
  resultRarity: string;
  ingredients: Record<string, number>;
  craftTimeSeconds: number;
  createdAt: string;
};

/**
 * Get all crafting recipes
 */
export async function getRecipes(sql: any): Promise<CraftingRecipe[]> {
  const query = sql`
    SELECT 
      id,
      name,
      result_item AS "resultItem",
      result_rarity AS "resultRarity",
      ingredients,
      craft_time_seconds AS "craftTimeSeconds",
      created_at AS "createdAt"
    FROM crafting_recipes
    ORDER BY name ASC
  `;

  const results = await query;
  
  return results.map((row: any) => ({
    id: row.id,
    name: row.name,
    resultItem: row.resultItem,
    resultRarity: row.resultRarity,
    ingredients: row.ingredients,
    craftTimeSeconds: row.craftTimeSeconds,
    createdAt: row.createdAt,
  }));
}

/**
 * Get recipe by ID
 */
export async function getRecipeById(id: string, sql: any): Promise<CraftingRecipe | null> {
  const query = sql`
    SELECT 
      id,
      name,
      result_item AS "resultItem",
      result_rarity AS "resultRarity",
      ingredients,
      craft_time_seconds AS "craftTimeSeconds",
      created_at AS "createdAt"
    FROM crafting_recipes
    WHERE id = ${sql.typed.text(id)}
  `;

  const results = await query;
  
  if (results.length === 0) {
    return null;
  }

  const row = results[0];
  return {
    id: row.id,
    name: row.name,
    resultItem: row.resultItem,
    resultRarity: row.resultRarity,
    ingredients: row.ingredients,
    craftTimeSeconds: row.craftTimeSeconds,
    createdAt: row.createdAt,
  };
}

/**
 * Check if agent can craft a recipe
 */
export async function canCraft(agentId: string, recipeId: string, sql: any): Promise<boolean> {
  const recipe = await getRecipeById(recipeId, sql);
  
  if (!recipe) {
    return false;
  }

  // Check inventory for items
  const itemIngredients = Object.entries(recipe.ingredients).filter(([key]) => key !== 'coins');
  
  for (const [itemType, requiredCount] of itemIngredients) {
    const inventoryQuery = sql`
      SELECT COUNT(*) AS count
      FROM furniture
      WHERE agent_id = ${sql.typed.uuid(agentId)}
        AND item_def_id = ${sql.typed.text(itemType)}
        AND room_id IS NULL
    `;

    const inventoryResults = await inventoryQuery;
    const availableCount = Number(inventoryResults[0]?.count || 0);

    if (availableCount < requiredCount) {
      return false;
    }
  }

  // Check coins if required
  if (recipe.ingredients.coins) {
    const balanceQuery = sql`
      SELECT coins
      FROM agent_balances
      WHERE agent_id = ${sql.typed.text(agentId)}
    `;

    const balanceResults = await balanceQuery;
    const currentCoins = Number(balanceResults[0]?.coins || 0);

    if (currentCoins < recipe.ingredients.coins) {
      return false;
    }
  }

  return true;
}

/**
 * Craft an item (consumes ingredients, creates result)
 */
export async function craft(
  agentId: string,
  recipeId: string,
  sql: any
): Promise<{ success: boolean; itemId: string }> {
  const recipe = await getRecipeById(recipeId, sql);

  if (!recipe) {
    throw new Error('Recipe not found');
  }

  const hasIngredients = await canCraft(agentId, recipeId, sql);

  if (!hasIngredients) {
    throw new Error('Insufficient ingredients');
  }

  // Consume item ingredients
  const itemIngredients = Object.entries(recipe.ingredients).filter(([key]) => key !== 'coins');

  for (const [itemType, requiredCount] of itemIngredients) {
    const itemsQuery = sql`
      SELECT id
      FROM furniture
      WHERE agent_id = ${sql.typed.uuid(agentId)}
        AND item_def_id = ${sql.typed.text(itemType)}
        AND room_id IS NULL
      LIMIT ${sql.typed.int4(requiredCount)}
    `;

    const items = await itemsQuery;

    for (const item of items) {
      const deleteQuery = sql`
        DELETE FROM furniture
        WHERE id = ${sql.typed.uuid(item.id)}
      `;

      await deleteQuery;
    }
  }

  // Consume coins if required
  if (recipe.ingredients.coins) {
    const deductCoinsQuery = sql`
      UPDATE agent_balances
      SET coins = coins - ${sql.typed.int4(recipe.ingredients.coins)}
      WHERE agent_id = ${sql.typed.text(agentId)}
    `;

    await deductCoinsQuery;
  }

  // Create result item
  const newItemId = crypto.randomUUID();

  const createItemQuery = sql`
    INSERT INTO furniture (id, agent_id, item_def_id, category, x, y, room_id, rarity)
    VALUES (
      ${sql.typed.uuid(newItemId)},
      ${sql.typed.uuid(agentId)},
      ${sql.typed.text(recipe.resultItem)},
      'crafted',
      NULL,
      NULL,
      NULL,
      ${sql.typed.text(recipe.resultRarity)}
    )
  `;

  await createItemQuery;

  return {
    success: true,
    itemId: newItemId,
  };
}

/**
 * Get recipes by result item type
 */
export async function getRecipesByResult(itemType: string, sql: any): Promise<CraftingRecipe[]> {
  const query = sql`
    SELECT 
      id,
      name,
      result_item AS "resultItem",
      result_rarity AS "resultRarity",
      ingredients,
      craft_time_seconds AS "craftTimeSeconds",
      created_at AS "createdAt"
    FROM crafting_recipes
    WHERE result_item = ${sql.typed.text(itemType)}
    ORDER BY name ASC
  `;

  const results = await query;
  
  return results.map((row: any) => ({
    id: row.id,
    name: row.name,
    resultItem: row.resultItem,
    resultRarity: row.resultRarity,
    ingredients: row.ingredients,
    craftTimeSeconds: row.craftTimeSeconds,
    createdAt: row.createdAt,
  }));
}
