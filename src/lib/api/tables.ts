import { apiFetch } from "./client";
import { Table, TableStatus } from "@/types/restaurant";

export interface BackendTable {
  id: string;
  restaurant_id: string;
  label?: string;
  table_number?: string;
  floor_name?: string;
  capacity: number;
  status: TableStatus;
  current_bill: number | string;
  current_order_id?: string;
  active_order_id?: string;
  assigned_waiter_id?: string;
  captain_name?: string;
  opened_at?: string;
  qr_token?: string;
}

export function mapBackendTable(t: BackendTable): Table {
  const rawLabel = t.label || t.table_number || t.id;
  const section = t.floor_name || "Main AC Hall";

  return {
    id: t.id,
    label: rawLabel.startsWith("T-") ? `Table ${rawLabel.replace("T-", "")}` : rawLabel,
    capacity: t.capacity,
    status: t.status,
    currentBill: Number(t.current_bill || 0),
    captainName: t.captain_name || undefined,
    assignedWaiterId: t.assigned_waiter_id || undefined,
    openedAt: t.opened_at,
    qrToken: t.qr_token,
    currentOrderId: t.current_order_id || t.active_order_id,
    section,
  };
}

export async function fetchTables(): Promise<Table[]> {
  const data = await apiFetch<BackendTable[]>("/tables");
  return data.map(mapBackendTable);
}

export async function fetchFloors(): Promise<string[]> {
  try {
    return await apiFetch<string[]>("/tables/floors/all");
  } catch {
    return ["Main AC Hall"];
  }
}

export async function createTable(payload: { label: string; capacity: number; floor_name: string }): Promise<Table> {
  const data = await apiFetch<BackendTable>("/tables", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapBackendTable(data);
}

export async function updateTable(tableId: string, payload: { label?: string; capacity?: number; floor_name?: string }): Promise<Table> {
  const data = await apiFetch<BackendTable>(`/tables/${tableId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return mapBackendTable(data);
}

export async function deleteTable(tableId: string): Promise<{ success: boolean; message: string }> {
  return await apiFetch<{ success: boolean; message: string }>(`/tables/${tableId}`, {
    method: "DELETE",
  });
}

export async function updateTableStatus(tableId: string, status: TableStatus, captainName?: string): Promise<Table> {
  const data = await apiFetch<BackendTable>(`/tables/${tableId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, captain_name: captainName }),
  });
  return mapBackendTable(data);
}

export async function transferTable(fromTableId: string, targetTableId: string): Promise<Table> {
  const data = await apiFetch<BackendTable>(`/tables/${fromTableId}/transfer`, {
    method: "POST",
    body: JSON.stringify({ target_table_id: targetTableId }),
  });
  return mapBackendTable(data);
}

export async function assignTableWaiter(tableId: string, waiterId: string | null): Promise<Table> {
  const data = await apiFetch<BackendTable>(`/tables/${tableId}/waiter`, {
    method: "POST",
    body: JSON.stringify({ waiter_id: waiterId }),
  });
  return mapBackendTable(data);
}

export async function regenerateTableQR(tableId: string): Promise<Table> {
  const data = await apiFetch<BackendTable>(`/tables/${tableId}/regenerate-qr`, {
    method: "POST",
  });
  return mapBackendTable(data);
}

