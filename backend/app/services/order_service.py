from datetime import datetime, timezone
from decimal import Decimal
import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.restaurant import Restaurant
from app.models.table import DiningTable, TableStatus
from app.models.menu import MenuItem
from app.models.order import Order, OrderItem, OrderMode, OrderStatus, PaymentStatus, PlacedBy
from app.models.kot import KOT, KOTItem, KOTStatus
from app.models.payment import Payment, PaymentMethod, PaymentRecordStatus
from app.services.billing_service import BillingService
from app.services.inventory_service import InventoryService

class OrderService:
    @staticmethod
    def get_or_create_table_order(
        db: Session,
        restaurant_id: str,
        table_id: str,
        customer_name: str = "Guest",
        placed_by: PlacedBy = PlacedBy.POS
    ) -> Order:
        """
        Ensures each table has its own unique, independent active order.
        """
        # Acquire exclusive row lock on PostgreSQL to safely serialize concurrent orders
        table_q = db.query(DiningTable).filter(DiningTable.id == table_id, DiningTable.restaurant_id == restaurant_id)
        if db.bind and db.bind.dialect.name == "postgresql":
            table = table_q.with_for_update().first()
        else:
            table = table_q.first()
        if not table:
            raise ValueError(f"Table {table_id} not found")

        # Check if table already has an active order
        if table.current_order_id:
            order = db.query(Order).filter(Order.id == table.current_order_id).first()
            if order and order.status != OrderStatus.COMPLETED and order.status != OrderStatus.CANCELLED:
                return order

        # Create new order for this table
        now = datetime.now(timezone.utc)
        order_seq = db.query(Order).filter(Order.restaurant_id == restaurant_id).count() + 1
        order_num = f"{table.label}-{order_seq}"
        token_num = f"IND-{now.strftime('%Y%m%d')}-{order_seq:04d}"
        
        order = Order(
            id=f"ord-{uuid.uuid4().hex[:10]}",
            restaurant_id=restaurant_id,
            table_id=table_id,
            order_number=order_num,
            token_number=token_num,
            customer_name=customer_name,
            mode=OrderMode.DINE_IN,
            status=OrderStatus.PREPARING,
            payment_status=PaymentStatus.PENDING,
            placed_by=placed_by,
            subtotal=Decimal("0.00"),
            cgst=Decimal("0.00"),
            sgst=Decimal("0.00"),
            service_charge=Decimal("0.00"),
            discount=Decimal("0.00"),
            total_amount=Decimal("0.00")
        )
        db.add(order)
        db.flush()

        table.current_order_id = order.id
        table.status = TableStatus.OCCUPIED
        table.opened_at = now.strftime("%H:%M")
        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def add_or_update_order_item(
        db: Session,
        order_id: str,
        dish_id: str,
        delta_qty: int,
        notes: Optional[str] = None
    ) -> Order:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError("Order not found")
            
        dish = db.query(MenuItem).filter(MenuItem.id == dish_id).first()
        if not dish:
            raise ValueError("Dish not found")

        existing_item = db.query(OrderItem).filter(
            OrderItem.order_id == order_id,
            OrderItem.menu_item_id == dish_id
        ).first()

        if existing_item:
            new_qty = existing_item.quantity + delta_qty
            if new_qty <= 0:
                db.delete(existing_item)
            else:
                existing_item.quantity = new_qty
                if notes:
                    existing_item.notes = notes
        else:
            if delta_qty > 0:
                new_item = OrderItem(
                    id=f"item-{uuid.uuid4().hex[:10]}",
                    order_id=order_id,
                    menu_item_id=dish.id,
                    name=dish.name,
                    price=dish.price,
                    quantity=delta_qty,
                    dietary=dish.dietary,
                    station=dish.station,
                    notes=notes,
                    status="cooking"
                )
                db.add(new_item)

        db.flush()
        # Recalculate bill totals
        OrderService.recalculate_order_bill(db, order)
        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def recalculate_order_bill(db: Session, order: Order):
        restaurant = db.query(Restaurant).filter(Restaurant.id == order.restaurant_id).first()
        items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
        item_dicts = [{"price": it.price, "quantity": it.quantity} for it in items]
        
        subtotal, cgst, sgst, sc, disc, total = BillingService.calculate_totals(
            item_dicts, restaurant, order.discount
        )
        order.subtotal = subtotal
        order.cgst = cgst
        order.sgst = sgst
        order.service_charge = sc
        order.total_amount = total

        # If table attached, update table current bill
        if order.table_id:
            table = db.query(DiningTable).filter(DiningTable.id == order.table_id).first()
            if table:
                table.current_bill = total

    @staticmethod
    def fire_kot(
        db: Session,
        order_id: str,
        captain_notes: Optional[str] = None,
        items_to_fire: Optional[List[Any]] = None
    ) -> KOT:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError("Order not found")
            
        if items_to_fire is not None:
            items = items_to_fire
        else:
            items = db.query(OrderItem).filter(OrderItem.order_id == order_id).all()

        if not items:
            raise ValueError("Cannot fire KOT with empty order")

        # Get next sequential KOT number atomically on PostgreSQL
        last_kot_q = db.query(KOT).filter(KOT.restaurant_id == order.restaurant_id).order_by(KOT.kot_number.desc())
        if db.bind and db.bind.dialect.name == "postgresql":
            last_kot = last_kot_q.with_for_update().first()
        else:
            last_kot = last_kot_q.first()
        next_kot_num = (last_kot.kot_number + 1) if last_kot else 1001

        table_label = order.table.label if order.table else "Delivery/Takeaway"
        kot = KOT(
            id=f"kot-{uuid.uuid4().hex[:6]}-{next_kot_num}",
            restaurant_id=order.restaurant_id,
            order_id=order.id,
            kot_number=next_kot_num,
            table_id=table_label,
            status=KOTStatus.COOKING,
            placed_by=order.placed_by,
            captain_notes=captain_notes
        )
        db.add(kot)
        db.flush()

        for it in items:
            dish_id_val = getattr(it, "menu_item_id", getattr(it, "dish_id", None))
            kot_item = KOTItem(
                id=f"ki-{uuid.uuid4().hex[:10]}",
                kot_id=kot.id,
                dish_id=dish_id_val,
                name=it.name,
                quantity=it.quantity,
                dietary=it.dietary,
                station=it.station,
                is_prepared=False
            )
            db.add(kot_item)

        # Automatically consume inventory ingredients ONLY for items being fired!
        InventoryService.deduct_stock_for_order(db, order.restaurant_id, items, order.id)

        db.commit()
        db.refresh(kot)
        return kot

    @staticmethod
    def settle_bill(db: Session, order_id: str, payment_method: str = "cash") -> Order:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError("Order not found")

        order.payment_status = PaymentStatus.PAID
        order.status = OrderStatus.COMPLETED
        
        # Record payment
        pay_method_enum = PaymentMethod.CASH
        if payment_method.lower() == "upi":
            pay_method_enum = PaymentMethod.UPI
        elif payment_method.lower() == "card":
            pay_method_enum = PaymentMethod.CARD

        payment = Payment(
            id=f"pay-{uuid.uuid4().hex[:10]}",
            order_id=order.id,
            amount=order.total_amount,
            method=pay_method_enum,
            status=PaymentRecordStatus.SUCCESS,
            transaction_ref=f"TXN-{uuid.uuid4().hex[:8].upper()}"
        )
        db.add(payment)

        # Free up the table
        if order.table_id:
            table = db.query(DiningTable).filter(DiningTable.id == order.table_id).first()
            if table:
                table.status = TableStatus.VACANT
                table.current_order_id = None
                table.current_bill = Decimal("0.00")
                table.captain_name = None
                table.opened_at = None
                table.assigned_waiter_id = None

        # Automatic CRM Loyalty Points Accumulation (Phase 4)
        from app.services.crm_service import CRMService
        CRMService.award_points_for_order(db, order)

        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def transfer_table(db: Session, restaurant_id: str, from_table_id: str, to_table_id: str) -> DiningTable:
        from_table = db.query(DiningTable).filter(DiningTable.id == from_table_id, DiningTable.restaurant_id == restaurant_id).first()
        to_table = db.query(DiningTable).filter(DiningTable.id == to_table_id, DiningTable.restaurant_id == restaurant_id).first()
        if not from_table:
            raise ValueError(f"Source table {from_table_id} not found")
        if not to_table:
            raise ValueError(f"Target table {to_table_id} not found")
        if not from_table.current_order_id:
            raise ValueError(f"Table {from_table.label} has no active order to transfer")
        if to_table.status != TableStatus.VACANT:
            raise ValueError(f"Target table {to_table.label} is currently {to_table.status.value}, cannot transfer")

        order = db.query(Order).filter(Order.id == from_table.current_order_id).first()
        if order:
            order.table_id = to_table.id
            db.query(KOT).filter(KOT.order_id == order.id).update({"table_id": to_table.id})

        to_table.current_order_id = from_table.current_order_id
        to_table.status = from_table.status
        to_table.current_bill = from_table.current_bill
        to_table.captain_name = from_table.captain_name
        to_table.opened_at = from_table.opened_at

        from_table.current_order_id = None
        from_table.status = TableStatus.VACANT
        from_table.current_bill = Decimal("0.00")
        from_table.captain_name = None
        from_table.opened_at = None

        db.commit()
        db.refresh(to_table)
        db.refresh(from_table)
        return to_table
