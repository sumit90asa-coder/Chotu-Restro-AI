import { apiFetch } from "./client";

export interface AnalyticsOverview {
  today_revenue: number;
  revenue_growth_percent?: number;
  orders_count?: number;
  completed_orders_today?: number;
  occupied_tables: number;
  total_tables: number;
  occupancy_percent?: number;
  occupancy_rate_percent?: number;
  active_kots?: number;
  active_kot_count?: number;
  prep_pace_minutes?: number;
  avg_prep_time_minutes?: number;
  total_discount_given?: number;

  channel_sales: Array<{
    channel: string;
    label: string;
    order_count: number;
    revenue: number;
    percentage: number;
    average_order_value?: number;
  }>;
  weekly_traffic?: Array<{
    day: string;
    total_orders: number;
    store_orders?: number;
    aggregator_orders?: number;
    site_orders?: number;
    top_source?: string;
    revenue: number;
    is_peak_day: boolean;
  }>;
  hourly_revenue?: Array<{
    hour: string;
    revenue: number;
    order_count: number;
    is_current: boolean;
  }>;
  top_dishes?: Array<{
    dish_id: string;
    name: string;
    category?: string;
    quantity_sold: number;
    revenue: number;
  }>;
  low_stock_alerts?: Array<{
    id?: string;
    ingredient_id?: string;
    name: string;
    current_stock: number;
    reorder_threshold: number;
    unit: string;
    supplier?: string;
  }>;
}

export async function fetchAnalyticsOverview(period?: string): Promise<AnalyticsOverview> {
  const q = period ? `?period=${encodeURIComponent(period)}` : "";
  return await apiFetch<AnalyticsOverview>(`/analytics/overview${q}`);
}

export const fetchSalesOverview = fetchAnalyticsOverview;

export async function fetchTopDishes(): Promise<Array<{ name: string; quantity: number; revenue: number }>> {
  try {
    const overview = await fetchAnalyticsOverview();
    if (overview.top_dishes && overview.top_dishes.length > 0) {
      return overview.top_dishes.map((d) => ({
        name: d.name,
        quantity: d.quantity_sold,
        revenue: Number(d.revenue),
      }));
    }
  } catch {
    // Return empty list when unavailable
  }
  return [];
}

