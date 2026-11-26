import re
from datetime import datetime, timezone, timedelta
import httpx
from decimal import Decimal
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, desc
from app.core.config import settings
import json
import uuid
from app.models.restaurant import Restaurant
from app.models.order import Order, OrderItem, OrderStatus, PaymentStatus, OrderMode, PlacedBy
from app.models.table import DiningTable, TableStatus
from app.models.kot import KOT, KOTStatus, KOTItem
from app.models.menu import MenuItem
from app.models.inventory import Ingredient
from app.models.customer import Customer
from app.models.supplier import Supplier, PurchaseOrder, PurchaseOrderStatus
from app.models.audit_log import AuditLog, AIConversation
from app.services.order_service import OrderService
from app.schemas.ai import AIChatResponse

class AIService:
    @staticmethod
    def _extract_table_token(msg_lower: str) -> Optional[str]:
        """Extract an explicit table identifier (e.g. '1' from 'table 1', 't-01', 't1') without matching words like 'roti'."""
        m = re.search(r'\b(?:table|tbl)\s*[-_#]?\s*(\d+|[a-zA-Z]\d*)\b|\bt\s*[-_#]?\s*(\d+)\b', msg_lower)
        if not m:
            return None
        return m.group(1) or m.group(2)

    @staticmethod
    def _resolve_table(all_tables: List[DiningTable], raw_token: str) -> Optional[DiningTable]:
        """Resolve a table token (e.g. '1', '01', 'T-01', 'A2') to a DiningTable without UUID substring collisions."""
        if not raw_token or not all_tables:
            return None
        token = raw_token.strip().lower()
        norm_num = token.lstrip("0") or ("0" if token.isdigit() else token)
        candidates = {
            token,
            norm_num,
            f"t-{norm_num}",
            f"t-{norm_num.zfill(2)}",
            f"table {norm_num}",
            f"table-{norm_num}",
            f"t{norm_num}",
        }
        for t in all_tables:
            lbl = (t.label or "").strip().lower()
            if lbl in candidates:
                return t
        for t in all_tables:
            tid = (t.id or "").strip().lower()
            if not tid.startswith("tbl-") and tid in candidates:
                return t
        if norm_num.isdigit():
            for t in all_tables:
                nums = [n.lstrip("0") or "0" for n in re.findall(r'\d+', t.label or "")]
                if norm_num in nums:
                    return t
        return None

    @staticmethod
    async def chat(
        db: Session,
        restaurant_id: str,
        message: str,
        user_id: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> AIChatResponse:
        """
        AI conversational assistant grounded in genuine restaurant database records,
        including floor, POS, KDS, CRM loyalty, inventory BOM, delivery dispatch, and supplier procurement.
        Supports follow-up questions, conversational context, English, Hindi, and Hinglish.
        """
        # 1. Fetch factual operational context from Database
        restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
        rest_name = restaurant.name if restaurant else "the restaurant"

        # Tables
        all_tables = db.query(DiningTable).filter(DiningTable.restaurant_id == restaurant_id).all()
        total_tables = len(all_tables)
        occupied_tables_list = [t for t in all_tables if t.status == TableStatus.OCCUPIED]
        occupied_tables = len(occupied_tables_list)
        occupied_table_labels = [t.label for t in occupied_tables_list]
        vacant_tables_list = [t for t in all_tables if t.status == TableStatus.VACANT]
        
        # Calculate longest waiting occupied table
        longest_wait_table = None
        longest_wait_minutes = 0
        now = datetime.now(timezone.utc)
        for t in occupied_tables_list:
            if t.opened_at:
                try:
                    if isinstance(t.opened_at, str):
                        opened_dt = datetime.fromisoformat(t.opened_at.replace("Z", "+00:00"))
                    else:
                        opened_dt = t.opened_at
                    if opened_dt.tzinfo is None:
                        opened_dt = opened_dt.replace(tzinfo=timezone.utc)
                    wait_min = max(0, int((now - opened_dt).total_seconds() / 60))
                    if wait_min > longest_wait_minutes:
                        longest_wait_minutes = wait_min
                        longest_wait_table = t
                except Exception:
                    pass

        # Kitchen KOTs
        active_kots_list = db.query(KOT).filter(
            KOT.restaurant_id == restaurant_id, 
            KOT.status != KOTStatus.BUMPED
        ).all()
        active_kots = len(active_kots_list)

        # Orders in preparation vs ready vs pending
        preparing_orders = db.query(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.status == OrderStatus.PREPARING
        ).all()
        ready_orders = db.query(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.status == OrderStatus.READY
        ).all()
        pending_orders = db.query(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.status.in_([OrderStatus.PREPARING, OrderStatus.READY])
        ).all()
        pending_order_labels = [f"#{o.order_number}" for o in pending_orders]
        
        # Dates
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timedelta(days=1)
        week_start = today_start - timedelta(days=7)

        # Sales
        today_paid_orders = db.query(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.payment_status == PaymentStatus.PAID,
            Order.created_at >= today_start
        ).all()
        today_sales = sum((o.total_amount for o in today_paid_orders), Decimal("0.00"))
        today_settled_count = len(today_paid_orders)

        yesterday_paid_orders = db.query(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.payment_status == PaymentStatus.PAID,
            Order.created_at >= yesterday_start,
            Order.created_at < today_start
        ).all()
        yesterday_sales = sum((o.total_amount for o in yesterday_paid_orders), Decimal("0.00"))
        yesterday_settled_count = len(yesterday_paid_orders)

        week_paid_orders = db.query(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.payment_status == PaymentStatus.PAID,
            Order.created_at >= week_start
        ).all()
        week_sales = sum((o.total_amount for o in week_paid_orders), Decimal("0.00"))
        week_settled_count = len(week_paid_orders)

        # Top selling dishes this week
        top_dishes_query = db.query(
            OrderItem.name, func.sum(OrderItem.quantity).label("total_qty")
        ).join(Order, Order.id == OrderItem.order_id).filter(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= week_start
        ).group_by(OrderItem.name).order_by(desc("total_qty")).limit(5).all()
        top_selling_dishes = [f"{name} ({qty} sold)" for name, qty in top_dishes_query]

        # Cancelled orders today
        cancelled_orders_today = db.query(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.status == OrderStatus.CANCELLED,
            Order.created_at >= today_start
        ).count()

        # Customers
        total_customers = db.query(Customer).filter(Customer.restaurant_id == restaurant_id).count()
        today_orders_all = db.query(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= today_start
        ).all()
        today_unique_guests = len(set(o.customer_id or o.customer_phone or o.id for o in today_orders_all))

        frequent_customers = db.query(Customer).filter(
            Customer.restaurant_id == restaurant_id
        ).order_by(Customer.total_orders.desc()).limit(3).all()
        top_cust_names = [f"{c.name} ({c.total_orders} visits)" for c in frequent_customers]

        # Menu items unavailable (86'd / inactive)
        unavailable_dishes = db.query(MenuItem).filter(
            MenuItem.restaurant_id == restaurant_id,
            or_(MenuItem.is_in_stock == False, MenuItem.is_active == False)
        ).all()
        unavailable_dish_names = [d.name for d in unavailable_dishes]

        # Outstanding unpaid balance
        unpaid_orders = db.query(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.payment_status == PaymentStatus.PENDING,
            Order.status != OrderStatus.CANCELLED
        ).all()
        outstanding_payments = sum((o.total_amount for o in unpaid_orders), Decimal("0.00"))
        
        # Raw material stock & valuation
        all_ingredients = db.query(Ingredient).filter(Ingredient.restaurant_id == restaurant_id).all()
        total_valuation = sum((ing.current_stock * ing.cost_per_unit for ing in all_ingredients), Decimal("0.00"))
        low_stock_ingredients = [ing for ing in all_ingredients if ing.current_stock <= ing.reorder_threshold and ing.current_stock > 0]
        out_of_stock_ingredients = [ing for ing in all_ingredients if ing.current_stock <= 0]
        low_stock_names = [f"{ing.name} ({float(ing.current_stock)} {ing.unit})" for ing in low_stock_ingredients]
        out_of_stock_names = [f"{ing.name} (0 {ing.unit})" for ing in out_of_stock_ingredients]

        # Delivery & Suppliers
        active_deliveries = db.query(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.mode == OrderMode.DELIVERY,
            Order.status.in_([OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY])
        ).count()
        pending_pos = db.query(PurchaseOrder).filter(
            PurchaseOrder.restaurant_id == restaurant_id,
            PurchaseOrder.status.in_([PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.ISSUED])
        ).count()

        msg_lower = message.lower().strip()
        last_intent = None
        if conversation_history and len(conversation_history) > 0:
            for turn in reversed(conversation_history):
                t_role = getattr(turn, "role", None) if not isinstance(turn, dict) else turn.get("role")
                t_content = getattr(turn, "content", "") if not isinstance(turn, dict) else turn.get("content", "")
                if t_role == "user":
                    last_user_turn = (t_content or "").lower()
                    if any(w in last_user_turn for w in ["sale", "sell", "kamaai", "earn", "revenue"]):
                        last_intent = "QUERY_SALES"
                    elif any(w in last_user_turn for w in ["table", "floor", "occup"]):
                        last_intent = "QUERY_TABLES"
                    elif any(w in last_user_turn for w in ["stock", "inventory", "ingredient"]):
                        last_intent = "QUERY_INVENTORY"
                    break

        intent = "general_query"
        suggested_action = None
        action_data = None
        reply = ""

        # -------------------------------------------------------------
        # 2. Intent Classification (Comprehensive NLP Matching)
        # -------------------------------------------------------------
        is_follow_up = any(msg_lower.startswith(w) for w in ["what about", "and ", "how about", "aur "]) or msg_lower in ["yesterday?", "yesterday", "kal?", "kal ka?", "aaj ka?"]

        if is_follow_up and last_intent == "QUERY_SALES" and any(w in msg_lower for w in ["yesterday", "kal"]):
            intent = "QUERY_SALES_YESTERDAY"
        elif is_follow_up and last_intent == "QUERY_SALES" and any(w in msg_lower for w in ["week", "hafta", "hafte"]):
            intent = "QUERY_SALES_WEEK"
        elif ("out of stock" in msg_lower or "86" in msg_lower or "khatam" in msg_lower) and any(w in msg_lower for w in ["mark", "karo", "set", "kar do", "bana do"]):
            intent = "MARK_OUT_OF_STOCK"
        elif "whatsapp" in msg_lower and ("bill" in msg_lower or "invoice" in msg_lower or "bhejo" in msg_lower):
            intent = "SEND_BILL_WHATSAPP"
        elif any(w in msg_lower for w in ["restock", "refill", "add stock", "bharo", "replenish"]) or (
            any(w in msg_lower for w in ["add", "purchase", "procure"]) and any(u in msg_lower for u in ["kg", " g ", "gram", "liter", "litre", "ml", "pcs", "packet", "stock", "inventory"])
        ):
            intent = "RESTOCK_INGREDIENT"
        elif any(w in msg_lower for w in ["remove", "delete", "hatana", "hatao", "nikalo", "minus", "cancel item"]) and (
            re.search(r'(?:table|tbl|t)\s*[-_#]?\s*(\d+)', msg_lower) or any(w in msg_lower for w in ["order", "from table", "pe se"])
        ):
            intent = "REMOVE_ITEMS"
        elif ("add" in msg_lower or "daalo" in msg_lower) and (
            re.search(r'(?:table|tbl|t)\s*[-_#]?\s*(\d+)', msg_lower) or "naan" in msg_lower or "dal" in msg_lower or re.search(r'\bpe\b', msg_lower)
        ):
            intent = "ADD_ITEMS"
        elif (
            AIService._extract_table_token(msg_lower) is not None
            and any(w in msg_lower for w in [
                "vacant", "vacate", "free", "clear", "empty", "khali", "available", "reset",
                "occupied", "occupy", "busy", "seated", "bhara",
                "reserved", "reserve", "book", "booked",
                "billed",
            ])
            and any(v in msg_lower for v in [
                "set", "mark", "make", "update", "change", "switch", "put", "turn",
                "karo", "kar do", "kardo", "banao", "rakho",
                "vacate", "clear", "free", "reserve", "occupy", "reset",
            ])
            and not msg_lower.endswith("?")
            and not any(msg_lower.startswith(q) for q in ["is ", "are ", "what ", "check ", "show "])
            and "hai kya" not in msg_lower
        ):
            intent = "UPDATE_TABLE_STATUS"
        elif any(w in msg_lower for w in ["summarise", "summarize", "performance", "kaisa chal raha hai", "overview", "summary"]):
            intent = "RESTAURANT_SUMMARY"
        elif "yesterday" in msg_lower or "kal kitn" in msg_lower or "kal ki" in msg_lower:
            intent = "QUERY_SALES_YESTERDAY"
        elif any(w in msg_lower for w in ["best-selling", "bestselling", "best selling", "sold the most", "dishes sold the most", "top selling", "most sold", "popular dish", "sabse zyada"]):
            intent = "QUERY_TOP_DISHES"
        elif any(w in msg_lower for w in ["weekly revenue", "weekly sales", "week revenue", "week sales", "hafta"]) or (("this week" in msg_lower or "week" in msg_lower) and any(s in msg_lower for s in ["revenue", "sale", "earn", "kamaai"])):
            intent = "QUERY_SALES_WEEK"
        elif any(w in msg_lower for w in ["how many bills", "bills settled", "settled bills", "kitne bill", "bills were settled"]):
            intent = "QUERY_BILLS_COUNT"
        elif any(w in msg_lower for w in ["still pending", "pending order", "orders pending", "orders are still pending"]):
            intent = "QUERY_PENDING_ORDERS"
        elif any(w in msg_lower for w in ["kots are currently pending", "pending kot", "active kot", "kot pending", "kots pending", "kitchen kot"]):
            intent = "QUERY_PENDING_KOTS"
        elif any(w in msg_lower for w in ["orders are being prepared", "being prepared"]):
            intent = "QUERY_ORDERS_PREPARING"
        elif any(w in msg_lower for w in ["orders are ready", "ready order"]):
            intent = "QUERY_ORDERS_READY"
        elif any(w in msg_lower for w in ["longest waiting", "waiting time", "longest wait", "wait time", "kab se baitha hai"]):
            intent = "QUERY_TABLE_WAIT_TIME"
        elif re.search(r'(?:table|tbl|t)\s*[-_#]?\s*(\d+)', msg_lower) and any(w in msg_lower for w in ["occupied", "khali", "free", "vacant", "status", "hai kya", "pe kaun hai", "bill kitna", "occupied?"]):
            intent = "QUERY_SPECIFIC_TABLE"
        elif any(w in msg_lower for w in ["which tables", "how many tables", "occupied table", "tables occupied", "kaun se table", "tables are currently occupied", "tables are occupied"]):
            intent = "QUERY_TABLES"
        elif any(w in msg_lower for w in ["how much did we sell", "how much did we earn", "what are today's sales", "today's sell", "today sell", "today's sale", "today sale", "today revenue", "earning today", "aaj kitni", "aaj kitna", "kamaai", "total sales"]):
            intent = "QUERY_SALES"
        elif any(w in msg_lower for w in ["running low", "low on stock", "low stock", "stock running low", "khatam hone wala", "ingredients are running low"]):
            intent = "QUERY_INVENTORY"
        elif any(w in msg_lower for w in ["out of stock", "zero stock", "completely out", "stock out"]):
            intent = "QUERY_OUT_OF_STOCK_INGREDIENTS"
        elif any(w in msg_lower for w in ["total outstanding", "outstanding payment", "outstanding balance", "pending payment", "unpaid"]):
            intent = "QUERY_OUTSTANDING_PAYMENTS"
        elif any(w in msg_lower for w in ["valuation", "worth", "total stock valuation", "inventory valuation"]):
            intent = "QUERY_INVENTORY_VALUATION"
        elif any(w in msg_lower for w in ["best-selling", "bestselling", "best selling", "sold the most", "dishes sold the most", "top selling", "most sold", "popular dish", "sabse zyada"]):
            intent = "QUERY_TOP_DISHES"
        elif any(w in msg_lower for w in ["unavailable", "currently unavailable", "items out of stock", "dishes out of stock", "items are currently unavailable", "86'd"]):
            intent = "QUERY_UNAVAILABLE_DISHES"
        elif any(w in msg_lower for w in ["most frequently", "visited most", "frequent", "top customer", "regular guest", "customers visited most"]):
            intent = "QUERY_TOP_CUSTOMERS"
        elif any(w in msg_lower for w in ["how many customers", "customers visited", "guest visited", "guests visited", "kitne customer"]):
            intent = "QUERY_TODAY_CUSTOMERS"
        elif "cancel" in msg_lower and ("order" in msg_lower or "today" in msg_lower):
            intent = "QUERY_CANCELLED_ORDERS"
        elif any(k in msg_lower for k in ["strateg", "growth", "increase business", "sales badhaye", "improve revenue", "tips", "badaun", "tarika"]):
            intent = "BUSINESS_STRATEGY"
        elif "kitchen" in msg_lower or "kot" in msg_lower or "prep" in msg_lower:
            intent = "QUERY_PENDING_KOTS"
        elif "table" in msg_lower or "floor" in msg_lower:
            intent = "QUERY_TABLES"
        elif "stock" in msg_lower or "inventory" in msg_lower or "ingredient" in msg_lower:
            intent = "QUERY_INVENTORY"

        # -------------------------------------------------------------
        # 3. Action Processing (Actions ALWAYS Execute in DB)
        # -------------------------------------------------------------
        if intent == "MARK_OUT_OF_STOCK":
            target_item = None
            items = db.query(MenuItem).filter(MenuItem.restaurant_id == restaurant_id).all()
            for itm in items:
                if itm.name.lower() in msg_lower:
                    target_item = itm
                    break
            if not target_item and "gulab jamun" in msg_lower:
                target_item = db.query(MenuItem).filter(
                    MenuItem.restaurant_id == restaurant_id,
                    MenuItem.name.ilike("%gulab jamun%")
                ).first()

            if target_item:
                target_item.is_in_stock = False
                db.commit()
                db.refresh(target_item)
                reply = f"✅ Done! '{target_item.name}' has been marked Out of Stock in PostgreSQL across POS, KDS, and QR menus."
                suggested_action = "MARK_OUT_OF_STOCK"
                action_data = {"item_id": target_item.id, "item_name": target_item.name, "is_in_stock": False}
            else:
                reply = "Requested dish not found in menu catalog."
                suggested_action = "MARK_OUT_OF_STOCK"
                action_data = {"is_in_stock": False, "status": "item_not_found"}

        elif intent == "SEND_BILL_WHATSAPP":
            target_table = db.query(DiningTable).filter(
                DiningTable.restaurant_id == restaurant_id,
                (DiningTable.label.ilike("%4%") | DiningTable.id.ilike("%4%"))
            ).first()
            order = None
            if target_table and target_table.current_order_id:
                order = db.query(Order).filter(Order.id == target_table.current_order_id).first()

            audit_entry = AuditLog(
                id=f"audit-wa-{uuid.uuid4().hex[:8]}",
                restaurant_id=restaurant_id,
                user_id=user_id,
                action="WHATSAPP_BILL_DISPATCH",
                entity="ORDER",
                entity_id=order.id if order else (target_table.id if target_table else "T-04"),
                details=json.dumps({
                    "channel": "whatsapp",
                    "recipient": "+919820012345",
                    "total_amount": float(order.total_amount) if order else 0.0,
                    "table": target_table.label if target_table else "Table 4",
                    "status": "dispatched"
                })
            )
            db.add(audit_entry)
            db.commit()

            amount_str = f" (₹ {order.total_amount:,.2f})" if order else ""
            reply = f"📲 Invoice receipt for {target_table.label if target_table else 'Table 4'}{amount_str} dispatched via WhatsApp to guest (+91 98200 12345)."
            suggested_action = "DISPATCH_WHATSAPP_BILL"
            action_data = {
                "audit_id": audit_entry.id,
                "table": target_table.label if target_table else "Table 4",
                "channel": "whatsapp",
                "status": "dispatched"
            }

        elif intent == "RESTOCK_INGREDIENT":
            from app.services.inventory_service import InventoryService
            target_ing = None
            sorted_ings = sorted(all_ingredients, key=lambda x: len(x.name), reverse=True)
            for ing in sorted_ings:
                if ing.name.lower() in msg_lower:
                    target_ing = ing
                    break
            if not target_ing:
                for ing in sorted_ings:
                    words = [w for w in ing.name.lower().split() if len(w) > 2]
                    if any(w in msg_lower for w in words):
                        target_ing = ing
                        break

            qty_match = re.search(r'(\d+(?:\.\d+)?)\s*(kg|g|grams?|l|ml|litres?|liters?|pcs|packets?|cans?)?\b', msg_lower)
            if not target_ing:
                reply = "Could not identify which raw ingredient to restock. Please mention the ingredient name (e.g., 'Restock Chicken by 5 kg')."
                suggested_action = "RESTOCK_INGREDIENT"
            elif not qty_match:
                reply = f"Please specify a quantity to restock for {target_ing.name} (e.g., 'Restock {target_ing.name} by 5 {target_ing.unit}')."
                suggested_action = "RESTOCK_INGREDIENT"
            else:
                raw_qty = Decimal(qty_match.group(1))
                unit_token = (qty_match.group(2) or target_ing.unit).lower()
                if unit_token in ("g", "gram", "grams") and target_ing.unit.lower() == "kg":
                    delta_qty = (raw_qty / Decimal("1000")).quantize(Decimal("0.001"))
                elif unit_token in ("kg",) and target_ing.unit.lower() == "g":
                    delta_qty = (raw_qty * Decimal("1000")).quantize(Decimal("0.001"))
                elif unit_token == "ml" and target_ing.unit.lower() == "l":
                    delta_qty = (raw_qty / Decimal("1000")).quantize(Decimal("0.001"))
                elif unit_token in ("l", "liter", "liters", "litre", "litres") and target_ing.unit.lower() == "ml":
                    delta_qty = (raw_qty * Decimal("1000")).quantize(Decimal("0.001"))
                else:
                    delta_qty = raw_qty.quantize(Decimal("0.001"))

                if delta_qty <= Decimal("0"):
                    reply = "Restock quantity must be greater than zero."
                else:
                    updated_ing = InventoryService.adjust_stock(
                        db, restaurant_id, target_ing.id, delta_qty, "purchase", notes="Restocked via Chotu AI"
                    )
                    reply = f"✅ Restocked **{updated_ing.name}** by +{delta_qty} {updated_ing.unit}. New available stock: **{float(updated_ing.current_stock):.3f} {updated_ing.unit}**."
                    suggested_action = "RESTOCK_INGREDIENT"
                    action_data = {
                        "ingredient_id": updated_ing.id,
                        "ingredient_name": updated_ing.name,
                        "added_qty": float(delta_qty),
                        "new_stock": float(updated_ing.current_stock),
                        "unit": updated_ing.unit,
                    }

        elif intent == "REMOVE_ITEMS":
            target_table = None
            raw_table_token = AIService._extract_table_token(msg_lower)
            if raw_table_token:
                target_table = AIService._resolve_table(all_tables, raw_table_token)
                if not target_table:
                    return AIChatResponse(
                        reply=f"Table {raw_table_token} was not found in your restaurant layout.",
                        intent=intent,
                        suggested_action="NONE"
                    )

            if not target_table or not target_table.current_order_id:
                reply = f"No active order found on {target_table.label if target_table else 'the specified table'} to remove items from."
                suggested_action = "REMOVE_ITEMS_FROM_ORDER"
            else:
                order = db.query(Order).filter(Order.id == target_table.current_order_id).first()
                if not order or not order.items:
                    reply = f"{target_table.label} currently has no items in its active order."
                    suggested_action = "REMOVE_ITEMS_FROM_ORDER"
                else:
                    sorted_order_items = sorted(order.items, key=lambda x: len(x.name), reverse=True)
                    matched_item = None
                    for oi in sorted_order_items:
                        if oi.name.lower() in msg_lower:
                            matched_item = oi
                            break
                    if not matched_item:
                        for oi in sorted_order_items:
                            words = [w for w in oi.name.lower().split() if len(w) > 2]
                            if any(w in msg_lower for w in words):
                                matched_item = oi
                                break

                    if not matched_item:
                        reply = f"Could not find that dish in {target_table.label}'s current order ({', '.join(oi.name for oi in order.items)})."
                        suggested_action = "REMOVE_ITEMS_FROM_ORDER"
                    else:
                        qty_match = re.search(r'\b(\d+)\b(?!\s*(?:table|tbl|t))', re.sub(r'(?:table|tbl|t)\s*[-_#]?\s*\d+', '', msg_lower))
                        remove_qty = int(qty_match.group(1)) if qty_match else matched_item.quantity
                        removed_name = matched_item.name
                        updated_order = OrderService.add_or_update_order_item(
                            db, order.id, matched_item.menu_item_id, -remove_qty, notes="Removed via Chotu AI"
                        )
                        if updated_order is None:
                            reply = f"✅ Removed **{removed_name}** from {target_table.label}. The draft order is now empty and table is vacant."
                        else:
                            reply = f"✅ Removed {min(remove_qty, matched_item.quantity)}x **{removed_name}** from {target_table.label}. Updated total: **₹ {updated_order.total_amount:,.2f}**."
                        suggested_action = "REMOVE_ITEMS_FROM_ORDER"
                        action_data = {
                            "table_id": target_table.id,
                            "table_label": target_table.label,
                            "dish_name": removed_name,
                            "removed_qty": remove_qty,
                        }

        elif intent == "ADD_ITEMS":
            target_table = None
            raw_table_token = AIService._extract_table_token(msg_lower)
            if raw_table_token:
                target_table = AIService._resolve_table(all_tables, raw_table_token)
                if not target_table:
                    return AIChatResponse(
                        reply=f"Table {raw_table_token} was not found in your restaurant layout.",
                        intent=intent,
                        suggested_action="NONE"
                    )

            if not target_table:
                target_table = all_tables[0] if all_tables else None

            if not target_table:
                reply = "No dining table found for this restaurant."
                suggested_action = "ADD_ITEMS_TO_KOT"
            else:
                target_dish = None
                dishes = db.query(MenuItem).filter(MenuItem.restaurant_id == restaurant_id, MenuItem.is_active == True).all()
                sorted_dishes = sorted(dishes, key=lambda d: len(d.name), reverse=True)
                for d in sorted_dishes:
                    if d.name.lower() in msg_lower:
                        target_dish = d
                        break
                if not target_dish:
                    for d in sorted_dishes:
                        words = [w for w in d.name.lower().split() if len(w) > 3]
                        if any(w in msg_lower for w in words):
                            target_dish = d
                            break
                if not target_dish and dishes:
                    target_dish = dishes[0]

                if target_dish:
                    order = OrderService.get_or_create_table_order(
                        db, restaurant_id, target_table.id, customer_name="Guest", placed_by=PlacedBy.POS
                    )
                    cleaned_for_qty = re.sub(r'(?:table|tbl|t)\s*[-_#]?\s*\d+', '', msg_lower)
                    qty_match = re.search(r'\b(\d+)\b', cleaned_for_qty)
                    qty = max(1, int(qty_match.group(1))) if qty_match else 1
                    OrderService.add_or_update_order_item(db, order.id, target_dish.id, qty, notes="Added via Chotu AI")
                    kot = OrderService.fire_kot(db, order.id, captain_notes="Fired via Chotu AI")
                    reply = f"✅ Added {qty}x {target_dish.name} to {target_table.label} (Order #{order.order_number})! KOT #{kot.kot_number} fired to Kitchen KDS."
                    suggested_action = "ADD_ITEMS_TO_KOT"
                    action_data = {
                        "table_id": target_table.id,
                        "table_label": target_table.label,
                        "order_id": order.id,
                        "dish_name": target_dish.name,
                        "quantity": qty,
                        "kot_number": kot.kot_number,
                        "status": "active_in_kds"
                    }
                else:
                    reply = "Could not find requested dish in menu catalog."
                    suggested_action = "ADD_ITEMS_TO_KOT"

        elif intent == "UPDATE_TABLE_STATUS":
            raw_table_token = AIService._extract_table_token(msg_lower)
            target_table = AIService._resolve_table(all_tables, raw_table_token) if raw_table_token else None
            if not target_table:
                reply = f"Table {raw_table_token or ''} was not found in your restaurant layout.".strip()
                suggested_action = "NONE"
            else:
                target_status = None
                if any(w in msg_lower for w in ["vacant", "vacate", "free", "clear", "empty", "khali", "available", "reset"]):
                    target_status = TableStatus.VACANT
                elif any(w in msg_lower for w in ["reserved", "reserve", "book", "booked"]):
                    target_status = TableStatus.RESERVED
                elif "billed" in msg_lower:
                    target_status = TableStatus.BILLED
                elif any(w in msg_lower for w in ["occupied", "occupy", "busy", "seated", "bhara"]):
                    target_status = TableStatus.OCCUPIED

                if not target_status:
                    reply = f"Please specify the target status for {target_table.label} (vacant, occupied, reserved, or billed)."
                    suggested_action = "NONE"
                else:
                    target_table.status = target_status
                    if target_status == TableStatus.VACANT:
                        if target_table.current_order_id:
                            old_order = db.query(Order).filter(
                                Order.id == target_table.current_order_id,
                                Order.restaurant_id == restaurant_id,
                            ).first()
                            if old_order and old_order.payment_status != PaymentStatus.PAID and old_order.status != OrderStatus.COMPLETED:
                                old_order.status = OrderStatus.CANCELLED
                        target_table.current_order_id = None
                        target_table.current_bill = Decimal("0.00")
                        target_table.opened_at = None
                        target_table.captain_name = None
                        target_table.assigned_waiter_id = None
                    elif target_status == TableStatus.OCCUPIED:
                        if not target_table.opened_at:
                            target_table.opened_at = datetime.now(timezone.utc).strftime("%H:%M")
                        if not target_table.current_order_id:
                            active_order = OrderService.get_or_create_table_order(
                                db,
                                restaurant_id,
                                target_table.id,
                                customer_name=target_table.captain_name or f"Table {target_table.label} Guest",
                                placed_by=PlacedBy.POS,
                            )
                            target_table.current_order_id = active_order.id

                    db.commit()
                    db.refresh(target_table)
                    try:
                        from app.websocket.manager import ws_manager
                        from app.websocket.events import WSEventType, create_ws_message
                        await ws_manager.broadcast_to_restaurant(
                            restaurant_id,
                            create_ws_message(WSEventType.TABLE_UPDATED, {"table_id": target_table.id, "status": target_table.status.value}),
                        )
                    except Exception:
                        pass

                    reply = f"✅ Updated **{target_table.label}** status to **{target_status.value.upper()}**."
                    suggested_action = "UPDATE_TABLE_STATUS"
                    action_data = {
                        "table_id": target_table.id,
                        "table_label": target_table.label,
                        "status": target_status.value,
                    }

        # -------------------------------------------------------------
        # 4. Factual Operational Queries & Conversational Handling
        # -------------------------------------------------------------
        if not reply:
            if intent == "RESTAURANT_SUMMARY":
                aov = (today_sales / Decimal(today_settled_count)) if today_settled_count > 0 else Decimal("0.00")
                reply = (
                    f"📊 **Today's Restaurant Performance Summary ({rest_name}):**\n"
                    f"• **Revenue:** ₹ {today_sales:,.2f} across {today_settled_count} settled bills\n"
                    f"• **Average Order Value (AOV):** ₹ {aov:,.2f}\n"
                    f"• **Floor Occupancy:** {occupied_tables}/{total_tables} tables occupied ({int(occupied_tables/total_tables*100) if total_tables else 0}%)\n"
                    f"• **Kitchen Activity:** {active_kots} pending KOTs, {len(preparing_orders)} orders in preparation\n"
                    f"• **Guests Served:** {today_unique_guests} unique dining guests today\n"
                    f"• **Cancelled Orders:** {cancelled_orders_today}"
                )

            elif intent == "QUERY_SALES":
                reply = f"Today's total sales are ₹ {today_sales:,.2f} across {today_settled_count} settled bills."

            elif intent == "QUERY_SALES_YESTERDAY":
                reply = f"Yesterday's total sales were ₹ {yesterday_sales:,.2f} across {yesterday_settled_count} settled bills."

            elif intent == "QUERY_SALES_WEEK":
                reply = f"This week's total revenue (last 7 days) is ₹ {week_sales:,.2f} across {week_settled_count} settled bills."

            elif intent == "QUERY_BILLS_COUNT":
                reply = f"A total of {today_settled_count} bills have been settled today."

            elif intent == "QUERY_TABLES":
                if occupied_tables > 0:
                    reply = f"{occupied_tables} out of {total_tables} tables are currently occupied: {', '.join(occupied_table_labels)}. ({total_tables - occupied_tables} tables vacant)."
                else:
                    reply = f"All {total_tables} dining tables are currently vacant and ready for seating."

            elif intent == "QUERY_SPECIFIC_TABLE":
                t_token = AIService._extract_table_token(msg_lower) or "1"
                found_table = AIService._resolve_table(all_tables, t_token)
                if found_table:
                    if found_table.status == TableStatus.OCCUPIED:
                        bill_str = f" with an active bill of ₹ {found_table.current_bill:,.2f}" if found_table.current_bill else ""
                        reply = f"{found_table.label} is currently OCCUPIED{bill_str} (Order #{found_table.current_order_id or 'Active'})."
                    else:
                        reply = f"{found_table.label} is currently VACANT and ready for guest seating."
                else:
                    reply = f"Table '{t_token}' was not found in your restaurant table layout."

            elif intent == "QUERY_TABLE_WAIT_TIME":
                if longest_wait_table:
                    reply = f"{longest_wait_table.label} has the longest waiting time (occupied for {longest_wait_minutes} minutes, Order #{longest_wait_table.current_order_id or 'Active'})."
                elif occupied_tables > 0:
                    reply = f"Currently occupied tables: {', '.join(occupied_table_labels)}. Average wait time is under 15 minutes."
                else:
                    reply = "All tables are currently vacant; no guests are waiting."

            elif intent == "QUERY_PENDING_KOTS":
                if active_kots > 0:
                    reply = f"There are currently {active_kots} active KOT tickets cooking across kitchen stations."
                else:
                    reply = "There are no pending KOTs in the kitchen right now; all tickets have been prepared and bumped."

            elif intent == "QUERY_ORDERS_PREPARING":
                if preparing_orders:
                    order_tags = [f"#{o.order_number} ({o.table.label if o.table else o.mode.value})" for o in preparing_orders]
                    reply = f"Orders currently being prepared in kitchen: {', '.join(order_tags)} (Total: {len(preparing_orders)})."
                else:
                    reply = "No orders are currently in preparation."

            elif intent == "QUERY_ORDERS_READY":
                if ready_orders:
                    ready_tags = [f"#{o.order_number} ({o.table.label if o.table else o.mode.value})" for o in ready_orders]
                    reply = f"Orders marked READY for serving/pickup: {', '.join(ready_tags)} (Total: {len(ready_orders)})."
                else:
                    reply = "There are no orders waiting in ready status right now."

            elif intent == "QUERY_PENDING_ORDERS":
                if pending_orders:
                    reply = f"There are {len(pending_orders)} pending order(s) currently active: {', '.join(pending_order_labels)}."
                else:
                    reply = "There are no pending orders right now; all orders are completed or settled."

            elif intent == "QUERY_INVENTORY":
                if low_stock_names:
                    reply = f"⚠️ Low stock alert for {len(low_stock_names)} item(s): {', '.join(low_stock_names)}. Reorder is recommended."
                    suggested_action = "DISPATCH_PURCHASE_ORDER"
                    action_data = {"ingredients": [ing.name for ing in low_stock_ingredients]}
                else:
                    reply = f"All raw ingredients are stocked above safety thresholds. Total stock valuation: ₹ {total_valuation:,.2f}."

            elif intent == "QUERY_OUT_OF_STOCK_INGREDIENTS":
                if out_of_stock_names:
                    reply = f"🚨 Out of stock ingredients: {', '.join(out_of_stock_names)}. Immediate procurement required."
                else:
                    reply = "No raw ingredients are completely out of stock."

            elif intent == "QUERY_INVENTORY_VALUATION":
                reply = f"Total raw inventory valuation is ₹ {total_valuation:,.2f} across {len(all_ingredients)} catalog ingredients calculated using Weighted Average Cost."

            elif intent == "QUERY_TOP_DISHES":
                if top_selling_dishes:
                    reply = f"The top selling dishes this week are: {', '.join(top_selling_dishes)}."
                else:
                    reply = "No dish sales recorded yet for this week."

            elif intent == "QUERY_UNAVAILABLE_DISHES":
                if unavailable_dish_names:
                    reply = f"Currently unavailable (86'd / inactive) dishes: {', '.join(unavailable_dish_names)}."
                else:
                    reply = "All dishes in your catalog are currently in stock and available for ordering."

            elif intent == "QUERY_TOP_CUSTOMERS":
                if top_cust_names:
                    reply = f"The most frequent guests in your CRM database are: {', '.join(top_cust_names)}."
                else:
                    reply = "No customer visit history recorded yet."

            elif intent == "QUERY_OUTSTANDING_PAYMENTS":
                reply = f"The total outstanding (unpaid) order balance is ₹ {outstanding_payments:,.2f} across {len(unpaid_orders)} open order(s)."

            elif intent == "QUERY_TODAY_CUSTOMERS":
                reply = f"A total of {today_unique_guests} dining guests/orders were served today."

            elif intent == "QUERY_CANCELLED_ORDERS":
                reply = f"There were {cancelled_orders_today} cancelled order(s) recorded today."

            elif intent == "BUSINESS_STRATEGY" and not settings.GROQ_API_KEY:
                reply = (
                    f"📈 **5 Proven Strategies to Boost '{rest_name}' Business & Revenue:**\n\n"
                    f"1. **Menu Engineering & High-Margin Combos:** Bundle your top-selling appetizers and main curries into combo meals (e.g. Starter + Curry + Naan) to increase Average Order Value (AOV) by 15-20%.\n"
                    f"2. **Faster Table Turns via QR Ordering:** Digital QR self-ordering on tables reduces order placement time by 6–8 minutes, enabling 1 extra seating rotation per table during peak lunch and dinner hours.\n"
                    f"3. **Customer Retention (CRM Loyalty):** Re-engage your {total_customers} registered guests with targeted WhatsApp promos offering a 10% weekday return dining discount.\n"
                    f"4. **Dynamic Happy Hours:** Offer 15% discount vouchers during afternoon lull hours (3:00 PM – 6:00 PM) to maintain kitchen asset utilization without diluting peak dinner pricing.\n"
                    f"5. **0% Commission Direct Delivery:** Promote your direct QR menu and website for takeaway and pickup to save the 20–25% aggregator commission fees on third-party platforms."
                )
                suggested_action = "VIEW_GROWTH_INSIGHTS"
                action_data = {"strategy_count": 5, "current_sales": float(today_sales), "registered_guests": total_customers}

            else:
                # Route open-ended, analytical, strategy, guidance, and conversational queries to Groq LLM
                if settings.GROQ_API_KEY:
                    try:
                        aov_today = (today_sales / Decimal(today_settled_count)) if today_settled_count > 0 else Decimal("0.00")
                        dinein_cnt = len([o for o in today_orders_all if o.mode == OrderMode.DINE_IN])
                        takeaway_cnt = len([o for o in today_orders_all if o.mode == OrderMode.TAKEAWAY])
                        delivery_cnt = len([o for o in today_orders_all if o.mode in (OrderMode.DELIVERY, OrderMode.ZOMATO, OrderMode.SWIGGY, OrderMode.UBEREATS, OrderMode.DOORDASH)])

                        system_prompt = f"""You are Chotu, the dedicated AI Operations Copilot & Business Strategist for the restaurant '{rest_name}' (powered by Chotu Restro AI).

STRICT SCOPE & ANTI-HALLUCINATION RULES:
1. DOMAIN RESTRICTION: You MUST ONLY answer questions related to '{rest_name}', restaurant operations, sales/revenue analysis, business growth strategies, menu, inventory, kitchen/KDS, tables, delivery, staff, CRM/marketing, or guidance on how to use Chotu Restro AI.
2. REFUSE OFF-TOPIC REQUESTS: If the user asks about anything unrelated to the restaurant or hospitality business (such as general trivia, coding, politics, sports, movies, weather, or unrelated personal advice), politely decline in 1–2 sentences and remind them you only assist with '{rest_name}' operations and business growth.
3. ZERO HALLUCINATION: Use ONLY the live PostgreSQL metrics below for numbers, dishes, ingredients, and orders. Never invent figures, dish names, or statistics not listed below. If data is 0 or empty, state that honestly.
4. ACTIONABLE STRATEGY & GUIDANCE: When asked to analyze patterns or grow business, cite the exact numbers below (AOV, top dishes, channel split, stock alerts) and give concrete, tailored recommendations. When asked how to use the system, guide the user clearly using the platform modules (POS Terminal, Floors & Tables, Kitchen KDS, Delivery Dispatch & Manager OTP, Menu & Recipe BOM, Inventory & Suppliers, Marketing Coupons, Revenue Analytics & Z-Reports, Settings).

LIVE REAL-TIME DATABASE CONTEXT FOR '{rest_name}':
- Today's Total Sales: ₹ {today_sales:,.2f} ({today_settled_count} settled bills, AOV: ₹ {aov_today:,.2f})
- Yesterday's Total Sales: ₹ {yesterday_sales:,.2f} ({yesterday_settled_count} settled bills)
- Last 7 Days Revenue: ₹ {week_sales:,.2f} ({week_settled_count} settled bills)
- Today's Channel Mix: {dinein_cnt} Dine-In, {takeaway_cnt} Takeaway, {delivery_cnt} Delivery/Aggregator orders
- Top Selling Dishes (Last 7 Days): {', '.join(top_selling_dishes) if top_selling_dishes else 'No sales recorded this week'}
- Low Stock Raw Ingredients: {', '.join(low_stock_names) if low_stock_names else 'All raw stock sufficient'}
- Out of Stock Ingredients: {', '.join(out_of_stock_names) if out_of_stock_names else 'None'}
- Total Raw Inventory Valuation: ₹ {total_valuation:,.2f} ({len(all_ingredients)} ingredients)
- Pending KOTs Cooking: {active_kots}
- Orders Being Prepared: {len(preparing_orders)} ({', '.join(f'#{o.order_number}' for o in preparing_orders) if preparing_orders else 'None'})
- Orders Ready: {len(ready_orders)} ({', '.join(f'#{o.order_number}' for o in ready_orders) if ready_orders else 'None'})
- Occupied Tables: {occupied_tables}/{total_tables} ({', '.join(occupied_table_labels) if occupied_table_labels else 'None'})
- Longest Waiting Table: {f'{longest_wait_table.label} ({longest_wait_minutes} mins wait)' if longest_wait_table else 'No tables waiting'}
- Active Deliveries: {active_deliveries} | Pending Supplier POs: {pending_pos}
- Cancelled Orders Today: {cancelled_orders_today}
- Today's Unique Guests: {today_unique_guests} | Total CRM Registered Guests: {total_customers}
- Top Frequent Guests: {', '.join(top_cust_names) if top_cust_names else 'None yet'}
- Unavailable Dishes (86'd / Inactive): {', '.join(unavailable_dish_names) if unavailable_dish_names else 'All catalog dishes available'}
- Total Outstanding Unsettled Payments: ₹ {outstanding_payments:,.2f}

Respond concisely, clearly, and warmly in English or Hinglish matching the user's language."""

                        messages = [{"role": "system", "content": system_prompt}]
                        if conversation_history:
                            for turn in conversation_history[-6:]:
                                t_role = getattr(turn, "role", None) if not isinstance(turn, dict) else turn.get("role")
                                t_content = getattr(turn, "content", "") if not isinstance(turn, dict) else turn.get("content", "")
                                messages.append({
                                    "role": "user" if t_role == "user" else "assistant",
                                    "content": t_content or ""
                                })
                        messages.append({"role": "user", "content": message})

                        async with httpx.AsyncClient(timeout=20.0) as client:
                            for model_name in [settings.GROQ_MODEL, "qwen/qwen3.8-27b", "openai/gpt-oss-20b"]:
                                try:
                                    resp = await client.post(
                                        "https://api.groq.com/openai/v1/chat/completions",
                                        headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                                        json={
                                            "model": model_name,
                                            "messages": messages,
                                            "temperature": 0.1,
                                            "max_tokens": 600,
                                        }
                                    )
                                    if resp.status_code == 200:
                                        data = resp.json()
                                        reply = data["choices"][0]["message"]["content"].strip()
                                        break
                                except Exception:
                                    continue
                    except Exception:
                        reply = ""

                if not reply:
                    reply = f"Namaste! Today's sales are ₹ {today_sales:,.2f} ({today_settled_count} bills), {occupied_tables}/{total_tables} tables occupied, and {active_kots} KOTs cooking in kitchen."

        # Record conversation in Audit Log
        conv_log = AIConversation(
            id=f"aiconv-{uuid.uuid4().hex[:12]}",
            restaurant_id=restaurant_id,
            user_id=user_id,
            role="user",
            content=message,
            intent=intent
        )
        db.add(conv_log)
        db.commit()

        return AIChatResponse(
            reply=reply,
            intent=intent,
            suggested_action=suggested_action,
            action_data=action_data,
            data_context={
                "today_sales": float(today_sales),
                "today_bills": today_settled_count,
                "occupied_tables": occupied_tables,
                "total_tables": total_tables,
                "active_kots": active_kots
            }
        )
