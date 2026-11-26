import { apiFetch } from "./client";
import { OrderItem, Dietary } from "@/types/restaurant";

export interface BackendOrderItem {
  id?: string;
  dish_id: string;
  name: string;
  unit_price: number | string;
  quantity: number;
  dietary: Dietary;
  station: "tandoor" | "curry" | "bar" | "pantry";
  notes?: string;
  status?: "queued" | "cooking" | "ready" | "served";
}

export interface BackendOrder {
  id: string;
  order_number: string;
  table_id?: string;
  customer_name?: string;
  customer_phone?: string;
  mode: string;
  status: string;
  subtotal: number | string;
  cgst: number | string;
  sgst: number | string;
  service_charge: number | string;
  discount_amount: number | string;
  total_amount: number | string;
  placed_by: string;
  items: BackendOrderItem[];
}

export function mapBackendOrderItem(i: any): OrderItem {
  const priceVal = i.price !== undefined ? i.price : (i.unit_price !== undefined ? i.unit_price : 0);
  const dishIdVal = i.dish_id || i.menu_item_id || i.id || "";
  return {
    dishId: dishIdVal,
    name: i.name || "Item",
    price: Number(priceVal) || 0,
    quantity: Number(i.quantity) || 1,
    dietary: i.dietary || "veg",
    station: i.station || "curry",
    notes: i.notes,
    status: i.status || "cooking",
  };
}

export async function getTableOrder(tableId: string): Promise<{ order: BackendOrder; items: OrderItem[] }> {
  try {
    const order = await apiFetch<BackendOrder | null>(`/pos/tables/${tableId}/order`);
    if (!order || !order.id) {
      return {
        order: {
          id: "",
          order_number: "",
          table_id: tableId,
          status: "open",
          subtotal: 0,
          cgst: 0,
          sgst: 0,
          service_charge: 0,
          discount_amount: 0,
          total_amount: 0,
          placed_by: "pos",
          mode: "dine_in",
          items: [],
        },
        items: [],
      };
    }
    const items = (order.items || []).map(mapBackendOrderItem);
    return { order, items };
  } catch {
    return {
      order: {
        id: "",
        order_number: "",
        table_id: tableId,
        status: "open",
        subtotal: 0,
        cgst: 0,
        sgst: 0,
        service_charge: 0,
        discount_amount: 0,
        total_amount: 0,
        placed_by: "pos",
        mode: "dine_in",
        items: [],
      },
      items: [],
    };
  }
}

export async function addOrUpdateOrderItem(
  tableId: string,
  dishId: string,
  delta_qty: number = 1,
  notes?: string
): Promise<{ order: BackendOrder; items: OrderItem[] }> {
  const order = await apiFetch<BackendOrder>(`/pos/tables/${tableId}/order/items`, {
    method: "POST",
    body: JSON.stringify({
      dish_id: dishId,
      delta_qty,
      notes,
    }),
  });
  const items = (order.items || []).map(mapBackendOrderItem);
  return { order, items };
}

export async function removeOrderItem(
  tableId: string,
  dishId: string
): Promise<{ order: BackendOrder; items: OrderItem[] }> {
  const order = await apiFetch<BackendOrder>(`/pos/tables/${tableId}/order/items/${dishId}`, {
    method: "DELETE",
  });
  const items = (order.items || []).map(mapBackendOrderItem);
  return { order, items };
}

export async function transmitTableKot(
  tableId: string,
  notes?: string,
  customerName?: string,
  customerPhone?: string,
  orderMode?: string
): Promise<any> {
  return await apiFetch(`/pos/tables/${tableId}/fire-kot`, {
    method: "POST",
    body: JSON.stringify({
      captain_notes: notes,
      customer_name: customerName,
      customer_phone: customerPhone,
      mode: orderMode,
    }),
  });
}

export async function settleTableBill(
  tableId: string,
  paymentMethod: "cash" | "card" | "upi" = "upi",
  discountAmount: number = 0
): Promise<any> {
  return await apiFetch(`/pos/tables/${tableId}/settle`, {
    method: "POST",
    body: JSON.stringify({
      payment_method: paymentMethod,
      discount_amount: discountAmount,
    }),
  });
}
