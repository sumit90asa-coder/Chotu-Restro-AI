import { apiFetch } from "./client";
import { MenuItem, Dietary } from "@/types/restaurant";

export interface MenuItemVariantData {
  id?: string;
  name: string;
  price_adjustment: number;
  is_available?: boolean;
}

export interface BackendMenuItem {
  id: string;
  name: string;
  description: string;
  price: number | string;
  category_id?: string;
  category_name?: string;
  category: "starters" | "mains" | "breads" | "beverages" | "desserts" | string;
  dietary: Dietary;
  station: "tandoor" | "curry" | "bar" | "pantry";
  is_active: boolean;
  in_stock: boolean;
  spice_level?: 1 | 2 | 3;
  bestseller?: boolean;
  photo_url?: string | null;
  preparation_time_minutes?: number;
  variants?: MenuItemVariantData[];
}

export interface MenuItemCreatePayload {
  name: string;
  category: string;
  price: number;
  description?: string;
  dietary?: string;
  station?: string;
  photo_url?: string;
  preparation_time_minutes?: number;
  variants?: { name: string; price_adjustment: number }[];
}

const DISH_IMAGE_MAP: Record<string, string> = {
  "dish-01": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=500&q=80",
  "dish-02": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=500&q=80",
  "dish-03": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=500&q=80",
  "dish-04": "https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=500&q=80",
  "dish-05": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=500&q=80",
  "dish-06": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=500&q=80",
  "dish-07": "https://images.unsplash.com/photo-1589119908995-c6837fa14d48?auto=format&fit=crop&w=500&q=80",
  "dish-08": "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=500&q=80",
  "dish-09": "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=500&q=80",
  "dish-10": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=500&q=80",
};

function getDishImage(dishId: string, dishName: string = "", photoUrl?: string | null): string {
  if (photoUrl && photoUrl.trim()) return photoUrl;
  if (DISH_IMAGE_MAP[dishId]) return DISH_IMAGE_MAP[dishId];

  const lower = dishName.toLowerCase();
  if (lower.includes("biryani") || lower.includes("rice") || lower.includes("pulao")) {
    return "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=500&q=80";
  }
  if (lower.includes("paneer") || lower.includes("tikka") || lower.includes("kebab")) {
    return "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=500&q=80";
  }
  if (lower.includes("butter chicken") || lower.includes("chicken") || lower.includes("murg") || lower.includes("curry") || lower.includes("masala")) {
    return "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=500&q=80";
  }
  if (lower.includes("naan") || lower.includes("roti") || lower.includes("paratha") || lower.includes("bread") || lower.includes("kulcha")) {
    return "https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=500&q=80";
  }
  if (lower.includes("dal") || lower.includes("makhani") || lower.includes("tadka") || lower.includes("chana")) {
    return "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=500&q=80";
  }
  if (lower.includes("gulab") || lower.includes("jamun") || lower.includes("halwa") || lower.includes("kheer") || lower.includes("dessert") || lower.includes("ice cream")) {
    return "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=500&q=80";
  }
  if (lower.includes("lassi") || lower.includes("mojito") || lower.includes("chai") || lower.includes("drink") || lower.includes("shake") || lower.includes("beverage")) {
    return "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=500&q=80";
  }
  if (lower.includes("samosa") || lower.includes("pakora") || lower.includes("chaat") || lower.includes("roll")) {
    return "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=500&q=80";
  }
  return "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=500&q=80";
}

export function mapBackendMenuItem(item: BackendMenuItem): MenuItem {
  const isAvailable = (item as any).is_in_stock !== undefined
    ? Boolean((item as any).is_in_stock)
    : (item.in_stock !== undefined ? Boolean(item.in_stock) : true);

  const rawCat = (item as any).category_name || item.category || (item as any).category_id || "mains";
  let cleanCat = String(rawCat).replace(/^cat-/, "");
  if (/^[a-f0-9]{6,}$/i.test(cleanCat)) {
    cleanCat = (item as any).category_name || "Mains";
  }

  return {
    id: item.id,
    name: item.name,
    category: cleanCat as any,
    description: item.description,
    price: Number(item.price),
    dietary: item.dietary,
    station: item.station,
    inStock: isAvailable,
    spiceLevel: item.spice_level,
    bestseller: Boolean((item as any).bestseller ?? (item as any).is_bestseller ?? false),
    image: getDishImage(item.id, item.name, item.photo_url),
  };
}

export async function fetchMenuItems(category?: string): Promise<MenuItem[]> {
  const qs = category && category !== "all" ? `?category=${category}` : "";
  const data = await apiFetch<BackendMenuItem[]>(`/menu/items${qs}`);
  return data.map(mapBackendMenuItem);
}

export async function createMenuItem(payload: MenuItemCreatePayload): Promise<MenuItem> {
  const data = await apiFetch<BackendMenuItem>("/menu/items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapBackendMenuItem(data);
}

export async function addMenuItemVariant(
  itemId: string,
  variant: { name: string; price_adjustment: number }
): Promise<any> {
  return apiFetch(`/menu/items/${itemId}/variants`, {
    method: "POST",
    body: JSON.stringify(variant),
  });
}

export async function updateMenuItem(dishId: string, updates: { inStock?: boolean; price?: number; bestseller?: boolean }): Promise<MenuItem> {
  const body: any = {};
  if (updates.inStock !== undefined) body.is_in_stock = updates.inStock;
  if (updates.price !== undefined) body.price = updates.price;
  if (updates.bestseller !== undefined) body.is_bestseller = updates.bestseller;
  const data = await apiFetch<BackendMenuItem>(`/menu/items/${dishId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return mapBackendMenuItem(data);
}

export async function deleteMenuItem(dishId: string): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(`/menu/items/${dishId}`, {
    method: "DELETE",
  });
}
