from typing import List, Dict, Any, Optional
from decimal import Decimal
from pydantic import BaseModel

class ChannelSalesSummary(BaseModel):
    channel: str
    label: str
    percentage: float
    revenue: Decimal
    order_count: int
    average_order_value: Decimal

class DayTrafficSummary(BaseModel):
    day: str
    total_orders: int
    store_orders: int
    aggregator_orders: int
    site_orders: int
    top_source: str
    revenue: Decimal
    is_peak_day: bool = False

class TopSellingDish(BaseModel):
    dish_id: str
    name: str
    category: str
    quantity_sold: int
    revenue: Decimal

class HourlyRevenuePoint(BaseModel):
    hour: str
    revenue: Decimal
    order_count: int
    is_current: bool = False

class AnalyticsOverview(BaseModel):
    today_revenue: Decimal
    revenue_growth_percent: float
    occupied_tables: int
    total_tables: int
    occupancy_percent: float
    active_kots: int
    completed_orders_today: int
    prep_pace_minutes: float
    total_discount_given: Decimal = Decimal("0.00")
    channel_sales: List[ChannelSalesSummary]
    weekly_traffic: List[DayTrafficSummary]
    top_dishes: List[TopSellingDish]
    hourly_revenue: List[HourlyRevenuePoint] = []
    low_stock_alerts: List[Dict[str, Any]]
