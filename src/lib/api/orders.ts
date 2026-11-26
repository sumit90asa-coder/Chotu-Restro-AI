import { apiFetch } from "./client";
import { LiveOrder, OrderMode } from "@/types/restaurant";

export interface BackendOrderRecord {
  id: string;
  order_number: string;
  table_id?: string;
  customer_name?: string;
  customer_phone?: string;
  mode: string;
  status: "new" | "preparing" | "ready" | "out-for-delivery" | "completed";
  subtotal: number | string;
  total_amount: number | string;
  created_at: string;
  delivery_address?: string;
  items_summary?: string;
  items?: Array<{ name: string; quantity: number }>;
}

export function mapBackendOrderToLiveOrder(ord: BackendOrderRecord): LiveOrder {
  const itemsText = ord.items_summary || (ord.items && ord.items.length > 0
    ? ord.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")
    : "Standard Order");

  const createdDate = new Date(ord.created_at);
  const timeStr = isNaN(createdDate.getTime())
    ? "Just now"
    : createdDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "numeric", hour12: true });

  const modeLower = ord.mode.toLowerCase() as OrderMode;

  return {
    id: ord.id,
    orderNumber: ord.order_number,
    tokenNumber: `#${ord.order_number.replace("ORD-", "")}`,
    time: timeStr,
    customerName: ord.customer_name || (ord.table_id ? `Table ${ord.table_id}` : "Guest"),
    customerPhone: ord.customer_phone,
    mode: modeLower,
    tableId: ord.table_id,
    deliveryAddress: ord.delivery_address || (ord.mode === "delivery" ? "Bandra West, Mumbai 400050" : undefined),
    aggregatorDetails: ["zomato", "swiggy", "ubereats", "doordash"].includes(modeLower)
      ? {
          platform: modeLower as any,
          orderId: ord.order_number,
          riderName: "Raju S. (Assigned)",
          riderStatus: "Arriving at restaurant",
          otp: "4291",
        }
      : undefined,
    itemsSummary: itemsText,
    totalAmount: Number(ord.total_amount),
    status: (ord.status as any) || "preparing",
  };
}

export async function fetchLiveOrders(status?: string, mode?: string): Promise<LiveOrder[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (mode && mode !== "all") params.set("mode", mode);
  const qs = params.toString() ? `?${params.toString()}` : "";
  
  const data = await apiFetch<BackendOrderRecord[]>(`/orders${qs}`);
  return data
    .filter((ord) => Boolean(ord.items_summary) || (Array.isArray(ord.items) && ord.items.length > 0))
    .map(mapBackendOrderToLiveOrder);
}

export async function updateOrderStatus(orderId: string, status: string): Promise<LiveOrder> {
  const data = await apiFetch<BackendOrderRecord>(`/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return mapBackendOrderToLiveOrder(data);
}
