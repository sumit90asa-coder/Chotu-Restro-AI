import { apiFetch } from "./client";

export interface DeliveryOrderData {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  status: "new" | "preparing" | "ready" | "out-for-delivery" | "completed" | "cancelled";
  items_summary: string;
  total_amount: number;
  rider_name?: string | null;
  rider_phone?: string | null;
  dispatch_time?: string | null;
  delivered_time?: string | null;
  otp_verified: boolean;
  otp_attempts: number;
  created_at: string;
}

export interface DeliveryDispatchRequest {
  rider_name: string;
  rider_phone: string;
}

export interface DeliveryDispatchResponse {
  order_id: string;
  delivery_otp: string;
  expires_at: string;
  status: string;
}

export interface DeliveryOTPVerifyResponse {
  order_id: string;
  verified?: boolean;
  status: string;
  message: string;
}

export async function fetchDeliveryOrders(status?: string): Promise<DeliveryOrderData[]> {
  const params = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<DeliveryOrderData[]>(`/delivery/orders${params}`);
}

export async function dispatchDeliveryOrder(
  orderId: string,
  data: DeliveryDispatchRequest
): Promise<DeliveryDispatchResponse> {
  return apiFetch<DeliveryDispatchResponse>(`/delivery/orders/${orderId}/dispatch`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function verifyDeliveryOTP(
  orderId: string,
  otp: string
): Promise<DeliveryOTPVerifyResponse> {
  return apiFetch<DeliveryOTPVerifyResponse>(`/delivery/orders/${orderId}/verify-otp`, {
    method: "POST",
    body: JSON.stringify({ otp }),
  });
}

export async function regenerateDeliveryOTP(
  orderId: string
): Promise<{ status: string; message: string; order_id: string; delivery_otp: string }> {
  return apiFetch(`/delivery/orders/${orderId}/regenerate-otp`, {
    method: "POST",
  });
}

export async function managerOverrideDelivery(
  orderId: string,
  reason?: string
): Promise<DeliveryOTPVerifyResponse> {
  return apiFetch<DeliveryOTPVerifyResponse>(`/delivery/orders/${orderId}/manager-override`, {
    method: "POST",
    body: JSON.stringify({ reason: reason || "Manager verified customer handover manually" }),
  });
}
