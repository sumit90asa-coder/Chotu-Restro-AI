import { apiFetch } from "./client";
import { KOT, OrderItem } from "@/types/restaurant";

export interface BackendKOTItem {
  id: string;
  dish_id: string;
  name: string;
  quantity: number;
  station: "tandoor" | "curry" | "bar" | "pantry";
  notes?: string;
  is_prepared: boolean;
}

export interface BackendKOT {
  id: string;
  kot_number: number;
  table_id: string;
  status: "cooking" | "ready" | "bumped";
  placed_by: "pos" | "qr" | "voice";
  captain_notes?: string;
  created_at: string;
  bumped_at?: string;
  items: BackendKOTItem[];
}

export function mapBackendKOT(k: BackendKOT): KOT {
  const createdTime = new Date(k.created_at);
  const now = new Date();
  const elapsed = Math.max(0, Math.floor((now.getTime() - createdTime.getTime()) / 1000));

  const items: OrderItem[] = (k.items || []).map((it) => ({
    dishId: it.dish_id,
    id: it.id,
    name: it.name,
    price: 0,
    quantity: it.quantity,
    dietary: "veg", // default, not critical for KDS
    station: it.station,
    notes: it.notes,
    status: it.is_prepared ? "ready" : "cooking",
  } as any));

  return {
    id: k.id,
    kotNumber: k.kot_number,
    tableId: k.table_id,
    items,
    createdAt: createdTime.toLocaleTimeString("en-US", { hour12: false }),
    elapsedSeconds: elapsed,
    status: k.status,
    placedBy: k.placed_by,
    captainNotes: k.captain_notes,
    completedAt: k.bumped_at ? new Date(k.bumped_at).toLocaleTimeString("en-US", { hour12: false }) : undefined,
  };
}

export async function fetchKDSTickets(status?: "active" | "completed" | "all", station?: string): Promise<KOT[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (station && station !== "all") params.set("station", station);
  const qs = params.toString() ? `?${params.toString()}` : "";
  
  const data = await apiFetch<BackendKOT[]>(`/kds/tickets${qs}`);
  return data.map(mapBackendKOT);
}

export async function bumpKOT(kotId: string): Promise<KOT> {
  const data = await apiFetch<BackendKOT>(`/kds/tickets/${kotId}/bump`, {
    method: "POST",
  });
  return mapBackendKOT(data);
}

export async function recallKOT(kotId: string): Promise<KOT> {
  const data = await apiFetch<BackendKOT>(`/kds/tickets/${kotId}/recall`, {
    method: "POST",
  });
  return mapBackendKOT(data);
}

export async function toggleKOTItem(itemId: string): Promise<any> {
  return await apiFetch(`/kds/items/${itemId}/toggle-prepared`, {
    method: "PATCH",
  });
}
