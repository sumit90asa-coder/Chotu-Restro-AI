import { apiFetch } from "./client";

export interface Coupon {
  id: string;
  restaurant_id?: string;
  code: string;
  description?: string;
  discount_type: "percentage" | "flat";
  discount_value: number;
  min_order_value: number;
  max_discount?: number;
  usage_limit: number;
  used_count: number;
  is_active: boolean;
  expires_at?: string;
  created_at?: string;
}

export interface CouponValidateResponse {
  valid: boolean;
  code: string;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  final_subtotal: number;
  message: string;
}

export async function fetchCoupons(): Promise<Coupon[]> {
  return await apiFetch<Coupon[]>("/marketing/coupons");
}

export async function createCoupon(data: {
  code: string;
  description?: string;
  discount_type: "percentage" | "flat";
  discount_value: number;
  min_order_value?: number;
  max_discount?: number;
  usage_limit?: number;
}): Promise<Coupon> {
  return await apiFetch<Coupon>("/marketing/coupons", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function toggleCouponStatus(id: string): Promise<Coupon> {
  return await apiFetch<Coupon>(`/marketing/coupons/${id}/toggle`, {
    method: "PATCH",
  });
}

export async function deleteCoupon(id: string): Promise<{ message: string; id: string }> {
  return await apiFetch<{ message: string; id: string }>(`/marketing/coupons/${id}`, {
    method: "DELETE",
  });
}

export async function validateCoupon(code: string, subtotal: number): Promise<CouponValidateResponse> {
  return await apiFetch<CouponValidateResponse>("/marketing/coupons/validate", {
    method: "POST",
    body: JSON.stringify({ code, subtotal }),
  });
}
