import { apiFetch } from "./client";

export interface SupplierData {
  id: string;
  restaurant_id: string;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  address?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SupplierCreateData {
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
}

export interface PurchaseOrderItemData {
  id?: string;
  ingredient_id: string;
  ingredient_name?: string;
  ordered_quantity: number;
  received_quantity?: number;
  unit_cost: number;
  actual_unit_cost?: number;
  total_cost?: number;
}

export interface PurchaseOrderData {
  id: string;
  restaurant_id: string;
  po_number: string;
  supplier_id: string;
  supplier_name?: string;
  status: "draft" | "submitted" | "partially_received" | "received" | "cancelled";
  total_amount: number;
  invoice_number?: string | null;
  received_at?: string | null;
  created_at: string;
  items: PurchaseOrderItemData[];
}

export interface PurchaseOrderCreateData {
  supplier_id: string;
  items: {
    ingredient_id: string;
    ordered_quantity: number;
    unit_cost: number;
  }[];
}

export interface PurchaseOrderReceiveData {
  items: {
    ingredient_id: string;
    received_quantity: number;
    actual_unit_cost: number;
  }[];
  invoice_number?: string;
  idempotency_key?: string;
}

export async function fetchSuppliers(): Promise<SupplierData[]> {
  return apiFetch<SupplierData[]>("/suppliers");
}

export async function createSupplier(data: SupplierCreateData): Promise<SupplierData> {
  return apiFetch<SupplierData>("/suppliers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchPurchaseOrders(status?: string): Promise<PurchaseOrderData[]> {
  const params = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<PurchaseOrderData[]>(`/suppliers/purchase-orders${params}`);
}

export async function updateSupplier(
  supplierId: string,
  data: Partial<SupplierCreateData> & { is_active?: boolean }
): Promise<SupplierData> {
  return apiFetch<SupplierData>(`/suppliers/${supplierId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteSupplier(
  supplierId: string
): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(`/suppliers/${supplierId}`, {
    method: "DELETE",
  });
}

export async function createPurchaseOrder(
  data: PurchaseOrderCreateData
): Promise<PurchaseOrderData> {
  const payload = {
    supplier_id: data.supplier_id,
    notes: (data as any).notes || "",
    items: (data.items || []).map((it: any) => ({
      ingredient_id: it.ingredient_id,
      quantity: it.quantity ?? it.ordered_quantity ?? 1,
      ordered_quantity: it.ordered_quantity ?? it.quantity ?? 1,
      unit_cost: it.unit_cost ?? 0,
    })),
  };
  return apiFetch<PurchaseOrderData>("/suppliers/purchase-orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function receivePurchaseOrder(
  poId: string,
  data: PurchaseOrderReceiveData
): Promise<PurchaseOrderData> {
  return apiFetch<PurchaseOrderData>(`/suppliers/purchase-orders/${poId}/receive`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
