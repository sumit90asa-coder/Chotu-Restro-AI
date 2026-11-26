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
  cgst_percent?: number;
  sgst_percent?: number;
  service_charge_percent?: number;
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

function mapSettingsResponse(raw: any): RestaurantSettingsData {
  const cgst = Number(raw?.cgst_percent ?? raw?.cgst_rate ?? 2.5);
  const sgst = Number(raw?.sgst_percent ?? raw?.sgst_rate ?? 2.5);
  const sc = Number(raw?.service_charge_percent ?? raw?.service_charge_rate ?? 5.0);
  return {
    ...raw,
    cgst_percent: cgst,
    sgst_percent: sgst,
    service_charge_percent: sc,
    cgst_rate: cgst,
    sgst_rate: sgst,
    service_charge_rate: sc,
    service_charge_enabled: raw?.service_charge_enabled ?? sc > 0,
  };
}

export async function fetchSettings(): Promise<RestaurantSettingsData> {
  const raw = await apiFetch<any>("/settings");
  return mapSettingsResponse(raw);
}

export const fetchRestaurantSettings = fetchSettings;

export async function updateSettings(
  data: RestaurantSettingsUpdate
): Promise<RestaurantSettingsData> {
  const cgstVal = data.cgst_percent ?? data.cgst_rate;
  const sgstVal = data.sgst_percent ?? data.sgst_rate;
  const scVal =
    data.service_charge_enabled === false
      ? 0
      : (data.service_charge_percent ?? data.service_charge_rate);

  const payload: Record<string, any> = {
    name: data.name,
    address: data.address,
    phone: data.phone,
    tagline: data.tagline,
    gstin: data.gstin,
    fssai_number: data.fssai_number,
    currency: data.currency,
    upi_vpa: data.upi_vpa,
    auto_print_kot: data.auto_print_kot,
    invoice_prefix: data.invoice_prefix,
    timezone: data.timezone,
  };
  if (cgstVal !== undefined) payload.cgst_percent = cgstVal;
  if (sgstVal !== undefined) payload.sgst_percent = sgstVal;
  if (scVal !== undefined) payload.service_charge_percent = scVal;

  const raw = await apiFetch<any>("/settings", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return mapSettingsResponse(raw);
}
