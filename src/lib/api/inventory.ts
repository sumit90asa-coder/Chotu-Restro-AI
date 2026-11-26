import { apiFetch } from "./client";

export interface IngredientStock {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  reorder_threshold: number;
  min_reorder_level: number;
  cost_per_unit: number;
  is_low_stock: boolean;
  supplier_name?: string;
  status?: "In Stock" | "Low Stock" | "Out of Stock";
  last_updated?: string;
}

export interface StockAdjustmentPayload {
  quantity?: number;
  quantity_delta?: number;
  transaction_type?: "intake" | "wastage" | "adjustment";
  notes?: string;
  reason?: string;
}

export interface IngredientCreatePayload {
  name: string;
  unit?: string;
  current_stock?: number;
  reorder_threshold?: number;
  cost_per_unit?: number;
  supplier_name?: string;
}

export interface StockTransactionData {
  id: string;
  ingredient_id: string;
  transaction_type: string;
  quantity: number;
  reference_id?: string;
  notes?: string;
  created_at: string;
}

function mapIngredientStock(item: any): IngredientStock {
  const stock = Number(item.current_stock);
  const threshold = Number(item.reorder_threshold ?? item.min_reorder_level ?? 5);
  const isLow = Boolean(item.is_low_stock);
  const status: IngredientStock["status"] =
    stock <= 0 ? "Out of Stock" : isLow ? "Low Stock" : "In Stock";

  return {
    id: item.id,
    name: item.name,
    unit: item.unit,
    current_stock: stock,
    reorder_threshold: threshold,
    min_reorder_level: threshold,
    cost_per_unit: Number(item.cost_per_unit),
    is_low_stock: isLow,
    supplier_name: item.supplier_name,
    status,
  };
}

export async function fetchIngredients(): Promise<IngredientStock[]> {
  const data = await apiFetch<any[]>("/inventory/ingredients");
  return data.map(mapIngredientStock);
}

export async function createIngredient(
  payload: IngredientCreatePayload
): Promise<IngredientStock> {
  const item = await apiFetch<any>("/inventory/ingredients", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapIngredientStock(item);
}

export async function updateIngredient(
  ingredientId: string,
  payload: Partial<IngredientCreatePayload>
): Promise<IngredientStock> {
  const item = await apiFetch<any>(`/inventory/ingredients/${ingredientId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return mapIngredientStock(item);
}

export async function deleteIngredient(ingredientId: string): Promise<boolean> {
  await apiFetch<any>(`/inventory/ingredients/${ingredientId}`, {
    method: "DELETE",
  });
  return true;
}

export async function fetchStockTransactions(ingredientId?: string): Promise<StockTransactionData[]> {
  const query = ingredientId ? `?ingredient_id=${encodeURIComponent(ingredientId)}` : "";
  const data = await apiFetch<any[]>(`/inventory/transactions${query}`);
  return data.map((t) => ({
    id: t.id,
    ingredient_id: t.ingredient_id,
    transaction_type: t.transaction_type,
    quantity: Number(t.quantity),
    reference_id: t.reference_id,
    notes: t.notes,
    created_at: t.created_at,
  }));
}

export async function adjustIngredientStock(
  ingredientId: string,
  payload: StockAdjustmentPayload
): Promise<IngredientStock> {
  const body = {
    quantity: payload.quantity !== undefined ? payload.quantity : (payload.quantity_delta ?? 0),
    transaction_type: payload.transaction_type || "adjustment",
    notes: payload.notes || payload.reason || "Stock update via Inventory Hub",
  };
  const item = await apiFetch<any>(`/inventory/ingredients/${ingredientId}/adjust`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return mapIngredientStock(item);
}

export async function fetchStockAlerts(): Promise<any[]> {
  return await apiFetch<any[]>("/inventory/alerts");
}

export async function fetchLowStockIngredients(): Promise<IngredientStock[]> {
  try {
    const all = await fetchIngredients();
    return all.filter((i) => i.is_low_stock || i.current_stock <= i.min_reorder_level);
  } catch {
    return [];
  }
}

export interface DishRecipeItem {
  id: string;
  menu_item_id: string;
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  quantity_required: number;
}

export async function fetchDishRecipes(menuItemId: string): Promise<DishRecipeItem[]> {
  return await apiFetch<DishRecipeItem[]>(`/inventory/recipes/${menuItemId}`);
}

export async function linkRecipeIngredient(
  menuItemId: string,
  ingredientId: string,
  quantityRequired: number,
  unit?: string
): Promise<any> {
  return await apiFetch("/inventory/recipes/link", {
    method: "POST",
    body: JSON.stringify({
      menu_item_id: menuItemId,
      ingredient_id: ingredientId,
      quantity_required: quantityRequired,
      ...(unit ? { unit } : {}),
    }),
  });
}

export async function unlinkRecipeIngredient(recipeItemId: string): Promise<any> {
  return await apiFetch(`/inventory/recipes/${recipeItemId}`, {
    method: "DELETE",
  });
}

