import { apiFetch } from "./client";
import { MenuItem } from "@/types/restaurant";
import { mapBackendMenuItem, BackendMenuItem } from "./menu";

export interface QRMenuResponse {
  restaurant_name: string;
  table_id: string;
  table_label: string;
  table_status?: string;
  items: BackendMenuItem[];
}

export interface QRTableInfo {
  restaurant_name: string;
  restaurant_id: string;
  table_id: string;
  table_label: string;
  status: string;
  capacity: number;
  qr_token: string;
}

export interface QROrderItemInput {
  dish_id: string;
  name: string;
  price: number;
  quantity: number;
  dietary?: "veg" | "nonveg";
  station?: "tandoor" | "curry" | "bar" | "pantry";
  notes?: string;
}

export interface QROrderSubmission {
  customer_name: string;
  items: QROrderItemInput[];
  captain_notes?: string;
  table_id?: string;
  idempotency_key?: string;
}

export async function fetchQRMenu(token: string): Promise<QRMenuResponse> {
  return await apiFetch<QRMenuResponse>(`/qr/${token}/menu`);
}

export async function fetchQRTableInfo(token: string): Promise<QRTableInfo> {
  return await apiFetch<QRTableInfo>(`/qr/${token}/table`);
}

export async function fetchCurrentQROrder(token: string, sessionToken?: string | null): Promise<any | null> {
  try {
    const headers: Record<string, string> = {};
    if (sessionToken) {
      headers["X-Customer-Session"] = sessionToken;
    }
    return await apiFetch(`/qr/${token}/order`, { headers });
  } catch {
    return null;
  }
}

export async function submitQROrder(token: string, payload: QROrderSubmission, sessionToken?: string | null): Promise<any> {
  const headers: Record<string, string> = {};
  if (sessionToken) {
    headers["X-Customer-Session"] = sessionToken;
  }
  return await apiFetch(`/qr/${token}/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}
