import { apiFetch } from "./client";

export interface RestaurantSettingsData {
  id?: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  tax_rate?: number;
  cgst_rate?: number;
  sgst_rate?: number;
  service_charge_rate?: number;
  service_charge_enabled?: boolean;
  cgst_percent?: number | string | null;
  sgst_percent?: number | string | null;
  service_charge_percent?: number | string | null;
  currency: string;
  logo_url?: string | null;
  tagline?: string | null;
  gstin?: string | null;
  fssai_number?: string | null;
  business_hours?: Record<string, any> | null;
  upi_vpa?: string | null;
  auto_print_kot: boolean;
  invoice_prefix: string;
  timezone: string;
  tax_effective_from?: string | null;
}

export interface RestaurantSettingsUpdate {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  tax_rate?: number;
  cgst_rate?: number;
  sgst_rate?: number;
  service_charge_rate?: number;
  service_charge_enabled?: boolean;
  currency?: string;
  logo_url?: string;
  tagline?: string;
  gstin?: string;
  fssai_number?: string;
  business_hours?: Record<string, any>;
  upi_vpa?: string;
  auto_print_kot?: boolean;
  invoice_prefix?: string;
  timezone?: string;
}

export async function fetchSettings(): Promise<RestaurantSettingsData> {
  return apiFetch<RestaurantSettingsData>("/settings");
}

export const fetchRestaurantSettings = fetchSettings;

export async function updateSettings(
  data: RestaurantSettingsUpdate
): Promise<RestaurantSettingsData> {
  return apiFetch<RestaurantSettingsData>("/settings", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
