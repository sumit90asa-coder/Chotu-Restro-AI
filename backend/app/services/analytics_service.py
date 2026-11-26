from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from decimal import Decimal
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.order import Order, OrderItem, OrderMode, OrderStatus, PaymentStatus
from app.models.table import DiningTable, TableStatus
from app.models.kot import KOT, KOTStatus
from app.models.menu import MenuItem
from app.services.inventory_service import InventoryService
from app.schemas.analytics import AnalyticsOverview, ChannelSalesSummary, DayTrafficSummary, TopSellingDish, HourlyRevenuePoint

class AnalyticsService:
    @staticmethod
    def get_overview(db: Session, restaurant_id: str, period: str = "today") -> AnalyticsOverview:
        now = datetime.now(timezone.utc)
        ist = ZoneInfo("Asia/Kolkata")
        now_ist = now.astimezone(ist)
        
        # Calculate date boundaries based on requested period filter aligned with Asia/Kolkata
        if period == "yesterday":
            start_ist = datetime(now_ist.year, now_ist.month, now_ist.day, 0, 0, 0, tzinfo=ist) - timedelta(days=1)
            end_ist = datetime(now_ist.year, now_ist.month, now_ist.day, 0, 0, 0, tzinfo=ist)
        elif period == "last_7_days":
            start_ist = now_ist - timedelta(days=7)
            end_ist = now_ist
        elif period == "this_month":
            start_ist = datetime(now_ist.year, now_ist.month, 1, 0, 0, 0, tzinfo=ist)
            end_ist = now_ist
        else: # "today"
            start_ist = datetime(now_ist.year, now_ist.month, now_ist.day, 0, 0, 0, tzinfo=ist)
            end_ist = now_ist
            
        start_date = start_ist.astimezone(timezone.utc).replace(tzinfo=None)
        end_date = end_ist.astimezone(timezone.utc).replace(tzinfo=None)
        
        # 1. Period Revenue (Legitimate completed and paid orders, excluding cancelled)
        period_paid_orders = db.query(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.payment_status == PaymentStatus.PAID,
            Order.status != OrderStatus.CANCELLED,
            Order.created_at >= start_date,
            Order.created_at <= end_date
        ).all()
        
        period_rev = sum((o.total_amount for o in period_paid_orders), Decimal("0.00"))
        completed_count = len(period_paid_orders)

        # 2. Table Occupancy (Real-time snapshot)
        total_tables = db.query(DiningTable).filter(DiningTable.restaurant_id == restaurant_id).count()
        occupied_tables = db.query(DiningTable).filter(
            DiningTable.restaurant_id == restaurant_id,
            DiningTable.status == TableStatus.OCCUPIED
        ).count()
        occupancy_pct = (occupied_tables / total_tables * 100.0) if total_tables > 0 else 0.0

        # 3. Active KOT tickets
        active_kots = db.query(KOT).filter(
            KOT.restaurant_id == restaurant_id,
            KOT.status != KOTStatus.BUMPED
        ).count()

        # 4. Kitchen Prep Pace
        bumped_kots = db.query(KOT).filter(
            KOT.restaurant_id == restaurant_id,
            KOT.status == KOTStatus.BUMPED,
            KOT.completed_at >= start_date,
            KOT.completed_at <= end_date
        ).all()
        
        if bumped_kots:
            prep_durations = [(k.completed_at - k.created_at).total_seconds() / 60.0 for k in bumped_kots if k.completed_at]
            prep_pace = sum(prep_durations) / len(prep_durations) if prep_durations else 0.0
        else:
            prep_pace = 0.0

        # 5. Channel Sales Mix
        all_period_orders = db.query(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= start_date,
            Order.created_at <= end_date
        ).all()
        
        store_orders = [o for o in all_period_orders if o.mode in (OrderMode.DINE_IN, OrderMode.TAKEAWAY)]
        agg_orders = [o for o in all_period_orders if o.mode in (OrderMode.ZOMATO, OrderMode.SWIGGY, OrderMode.UBEREATS, OrderMode.DOORDASH)]
        site_orders = [o for o in all_period_orders if o.mode == OrderMode.DELIVERY]

        store_rev = sum((o.total_amount for o in store_orders if o.payment_status == PaymentStatus.PAID and o.status != OrderStatus.CANCELLED), Decimal("0.00"))
        agg_rev = sum((o.total_amount for o in agg_orders if o.payment_status == PaymentStatus.PAID and o.status != OrderStatus.CANCELLED), Decimal("0.00"))
        site_rev = sum((o.total_amount for o in site_orders if o.payment_status == PaymentStatus.PAID and o.status != OrderStatus.CANCELLED), Decimal("0.00"))
        gross_rev = store_rev + agg_rev + site_rev
        denom_rev = gross_rev if gross_rev > Decimal("0.00") else Decimal("1.00")

        channel_sales = [
            ChannelSalesSummary(
                channel="store",
                label="In-Store Sales (Dine-In + Counter)",
                percentage=round(float(store_rev / denom_rev * 100), 1) if gross_rev > 0 else 0.0,
                revenue=store_rev,
                order_count=len(store_orders),
                average_order_value=round(store_rev / max(len(store_orders), 1), 2)
            ),
            ChannelSalesSummary(
                channel="aggregators",
                label="Online Aggregators (Zomato + Swiggy)",
                percentage=round(float(agg_rev / denom_rev * 100), 1) if gross_rev > 0 else 0.0,
                revenue=agg_rev,
                order_count=len(agg_orders),
                average_order_value=round(agg_rev / max(len(agg_orders), 1), 2)
            ),
            ChannelSalesSummary(
                channel="site",
                label="Direct Website & QR Ordering",
                percentage=round(float(site_rev / denom_rev * 100), 1) if gross_rev > 0 else 0.0,
                revenue=site_rev,
                order_count=len(site_orders),
                average_order_value=round(site_rev / max(len(site_orders), 1), 2)
            )
        ]

        # 6. Weekly Traffic Summary (Past 7 calendar days grounded in database)
        weekly_traffic = []
        for i in range(7):
            day_ref = now - timedelta(days=6-i)
            day_start_dt = datetime(day_ref.year, day_ref.month, day_ref.day, 0, 0, 0, tzinfo=timezone.utc)
            day_end_dt = datetime(day_ref.year, day_ref.month, day_ref.day, 23, 59, 59, tzinfo=timezone.utc)
            day_name = day_ref.strftime("%A")
            
            day_orders = db.query(Order).filter(
                Order.restaurant_id == restaurant_id,
                Order.payment_status == PaymentStatus.PAID,
                Order.created_at >= day_start_dt,
                Order.created_at <= day_end_dt
            ).all()
            
            d_rev = sum((o.total_amount for o in day_orders), Decimal("0.00"))
            d_store = len([o for o in day_orders if o.mode in (OrderMode.DINE_IN, OrderMode.TAKEAWAY)])
            d_agg = len([o for o in day_orders if o.mode in (OrderMode.ZOMATO, OrderMode.SWIGGY, OrderMode.UBEREATS, OrderMode.DOORDASH)])
            d_site = len([o for o in day_orders if o.mode == OrderMode.DELIVERY])

            weekly_traffic.append(
                DayTrafficSummary(
                    day=day_name,
                    total_orders=len(day_orders),
                    store_orders=d_store,
                    aggregator_orders=d_agg,
                    site_orders=d_site,
                    top_source="In-Store Dining" if d_store >= max(d_agg, d_site, 1) else "Online Orders",
                    revenue=d_rev,
                    is_peak_day=False
                )
            )

        if weekly_traffic:
            max_r = max(d.revenue for d in weekly_traffic)
            if max_r > Decimal("0.00"):
                for d in weekly_traffic:
                    if d.revenue == max_r:
                        d.is_peak_day = True
                        break

        # 7. Top Selling Dishes in the period
        top_items_query = db.query(
            OrderItem.menu_item_id,
            OrderItem.name,
            func.sum(OrderItem.quantity).label("total_qty"),
            func.sum(OrderItem.price * OrderItem.quantity).label("total_rev")
        ).join(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= start_date,
            Order.created_at <= end_date
        ).group_by(OrderItem.menu_item_id, OrderItem.name).order_by(func.sum(OrderItem.quantity).desc()).limit(5).all()

        top_dishes = [
            TopSellingDish(
                dish_id=item[0],
                name=item[1],
                category="Mains",
                quantity_sold=item[2] or 0,
                revenue=Decimal(str(item[3] or "0.00"))
            ) for item in top_items_query
        ]

        # 8. Low Stock Alerts
        low_stock = InventoryService.get_low_stock_alerts(db, restaurant_id)

        # 9. Previous period revenue for real growth %
        period_span = max(end_date - start_date, timedelta(days=1))
        prev_start = start_date - period_span
        prev_end = start_date
        prev_paid_orders = db.query(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.payment_status == PaymentStatus.PAID,
            Order.status != OrderStatus.CANCELLED,
            Order.created_at >= prev_start,
            Order.created_at < prev_end
        ).all()
        prev_rev = sum((o.total_amount for o in prev_paid_orders), Decimal("0.00"))
        if prev_rev > Decimal("0.00"):
            growth_pct = round(float((period_rev - prev_rev) / prev_rev * Decimal("100")), 1)
        elif period_rev > Decimal("0.00"):
            growth_pct = 100.0
        else:
            growth_pct = 0.0

        # 10. Real Hourly Revenue Velocity (IST)
        hourly_buckets: Dict[int, Dict[str, Any]] = {}
        for h in range(11, 24):
            hourly_buckets[h] = {"rev": Decimal("0.00"), "cnt": 0}
        for o in period_paid_orders:
            created = o.created_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            h_ist = created.astimezone(ist).hour
            if h_ist not in hourly_buckets:
                hourly_buckets[h_ist] = {"rev": Decimal("0.00"), "cnt": 0}
            hourly_buckets[h_ist]["rev"] += o.total_amount
            hourly_buckets[h_ist]["cnt"] += 1

        current_hour_ist = now_ist.hour
        hourly_revenue = []
        for h in sorted(hourly_buckets.keys()):
            label_12h = f"{12 if h % 12 == 0 else h % 12} {'AM' if h < 12 else 'PM'}"
            hourly_revenue.append(
                HourlyRevenuePoint(
                    hour=label_12h,
                    revenue=hourly_buckets[h]["rev"],
                    order_count=hourly_buckets[h]["cnt"],
                    is_current=(h == current_hour_ist),
                )
            )

        total_discount = sum((o.discount or Decimal("0.00") for o in period_paid_orders), Decimal("0.00"))

        return AnalyticsOverview(
            today_revenue=period_rev,
            revenue_growth_percent=growth_pct,
            occupied_tables=occupied_tables,
            total_tables=total_tables,
            occupancy_percent=round(occupancy_pct, 1),
            active_kots=active_kots,
            completed_orders_today=completed_count,
            prep_pace_minutes=round(prep_pace, 1),
            total_discount_given=total_discount,
            channel_sales=channel_sales,
            weekly_traffic=weekly_traffic,
            top_dishes=top_dishes,
            hourly_revenue=hourly_revenue,
            low_stock_alerts=low_stock
        )
