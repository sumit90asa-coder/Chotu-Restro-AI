from datetime import datetime, timezone
from typing import List, Optional
from decimal import Decimal
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.order import Order, PlacedBy, OrderStatus, PaymentStatus, OrderMode
from app.models.table import DiningTable, TableStatus
from app.schemas.menu import TableResponse
from app.schemas.order import OrderResponse, BillSettlementRequest, CancelTableOrderRequest
from app.schemas.kot import KOTResponse
from app.services.order_service import OrderService
from app.api.deps import get_current_user
from app.models.user import User
from app.websocket.manager import ws_manager
from app.websocket.events import WSEventType, create_ws_message

router = APIRouter()

class ModifyItemRequest(BaseModel):
    dish_id: str
    delta_qty: int  # +1 or -1 or -qty to delete
    notes: Optional[str] = None

class FireKOTRequest(BaseModel):
    captain_notes: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    mode: Optional[str] = None
    delivery_address: Optional[str] = None

class ApplyDiscountRequest(BaseModel):
    discount_percent: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = None
    promo_code: Optional[str] = None

class UpdateOrderModeRequest(BaseModel):
    mode: str
    delivery_address: Optional[str] = None

def _empty_draft_order(table_id: str, restaurant_id: str) -> OrderResponse:
    return OrderResponse(
        id=f"draft-{table_id}",
        restaurant_id=restaurant_id,
        table_id=table_id,
        order_number="DRAFT",
        token_number="0",
        customer_name="Walk-in Guest",
        mode=OrderMode.DINE_IN,
        status=OrderStatus.NEW,
        payment_status=PaymentStatus.PENDING,
        placed_by=PlacedBy.POS,
        subtotal=Decimal("0.00"),
        cgst=Decimal("0.00"),
        sgst=Decimal("0.00"),
        service_charge=Decimal("0.00"),
        discount=Decimal("0.00"),
        total_amount=Decimal("0.00"),
        created_at=datetime.now(timezone.utc),
        items=[]
    )

@router.get("/tables/{table_id}/order", response_model=Optional[OrderResponse])
def get_table_order(
    table_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    CRITICAL: Pure read-only and idempotent. Returns current active order for this table,
    or a clean draft payload if table is vacant with no active session.
    """
    table = db.query(DiningTable).filter(
        DiningTable.id == table_id,
        DiningTable.restaurant_id == current_user.restaurant_id
    ).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    if not table.current_order_id:
        return _empty_draft_order(table.id, current_user.restaurant_id)
        
    order = db.query(Order).filter(
        Order.id == table.current_order_id,
        Order.restaurant_id == current_user.restaurant_id
    ).first()
    
    if not order or order.status in (OrderStatus.COMPLETED, OrderStatus.CANCELLED) or order.payment_status == PaymentStatus.PAID:
        # Reset stale reference if order is completed or cancelled
        table.current_order_id = None
        table.current_bill = Decimal("0.00")
        table.opened_at = None
        db.commit()
        return _empty_draft_order(table.id, current_user.restaurant_id)

    # Recalculate bill before returning to ensure completely authoritative totals
    OrderService.recalculate_order_bill(db, order)
    db.commit()
    db.refresh(order)
    return order

@router.post("/tables/{table_id}/order/items", response_model=OrderResponse)
async def modify_table_order_item(
    table_id: str,
    req: ModifyItemRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        order = OrderService.get_or_create_table_order(db, current_user.restaurant_id, table_id, placed_by=PlacedBy.POS)
        order = OrderService.add_or_update_order_item(db, order.id, req.dish_id, req.delta_qty, req.notes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if order is None:
        await ws_manager.broadcast_to_restaurant(
            current_user.restaurant_id,
            create_ws_message(WSEventType.TABLE_UPDATED, {"table_id": table_id, "status": "vacant"})
        )
        return _empty_draft_order(table_id, current_user.restaurant_id)
    await ws_manager.broadcast_to_restaurant(
        current_user.restaurant_id,
        create_ws_message(WSEventType.ORDER_UPDATED, {"order_id": order.id, "table_id": table_id, "total": float(order.total_amount)})
    )
    return order

@router.delete("/tables/{table_id}/order/items/{dish_id}", response_model=OrderResponse)
async def remove_table_order_item(
    table_id: str,
    dish_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        order = OrderService.get_or_create_table_order(db, current_user.restaurant_id, table_id, placed_by=PlacedBy.POS)
        order = OrderService.add_or_update_order_item(db, order.id, dish_id, delta_qty=-9999)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if order is None:
        await ws_manager.broadcast_to_restaurant(
            current_user.restaurant_id,
            create_ws_message(WSEventType.TABLE_UPDATED, {"table_id": table_id, "status": "vacant"})
        )
        return _empty_draft_order(table_id, current_user.restaurant_id)

    await ws_manager.broadcast_to_restaurant(
        current_user.restaurant_id,
        create_ws_message(WSEventType.ORDER_UPDATED, {"order_id": order.id, "table_id": table_id, "total": float(order.total_amount)})
    )
    return order

@router.post("/tables/{table_id}/order/discount", response_model=OrderResponse)
async def apply_table_order_discount(
    table_id: str,
    req: ApplyDiscountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Persist a percentage discount, flat discount, or validated promo code directly on the active Order
    and recalculate GST, service charge, total_amount, and table.current_bill in PostgreSQL.
    """
    from app.models.coupon import Coupon
    from app.services.billing_service import round_money

    order = OrderService.get_or_create_table_order(db, current_user.restaurant_id, table_id, placed_by=PlacedBy.POS)
    OrderService.recalculate_order_bill(db, order)
    subtotal = order.subtotal or Decimal("0.00")

    new_discount = Decimal("0.00")
    if req.promo_code is not None and req.promo_code.strip():
        code_clean = req.promo_code.strip().upper()
        coupon = (
            db.query(Coupon)
            .filter(Coupon.restaurant_id == current_user.restaurant_id, Coupon.code == code_clean)
            .first()
        )
        if not coupon:
            raise HTTPException(status_code=404, detail=f"Promo code '{code_clean}' is invalid or does not exist.")
        if not coupon.is_active:
            raise HTTPException(status_code=400, detail=f"Promo code '{code_clean}' is currently disabled.")
        if coupon.expires_at and coupon.expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail=f"Promo code '{code_clean}' has expired.")
        if subtotal < coupon.min_order_value:
            raise HTTPException(status_code=400, detail=f"Minimum order value of ₹ {coupon.min_order_value:.2f} required for '{code_clean}'.")
        if coupon.usage_limit and coupon.used_count >= coupon.usage_limit:
            raise HTTPException(status_code=400, detail=f"Promo code '{code_clean}' usage limit has been reached.")

        if coupon.discount_type == "percentage":
            new_discount = round_money((subtotal * coupon.discount_value) / Decimal("100.00"))
            if coupon.max_discount:
                new_discount = min(new_discount, coupon.max_discount)
        else:
            new_discount = min(coupon.discount_value, subtotal)
    elif req.discount_percent is not None:
        if req.discount_percent < Decimal("0") or req.discount_percent > Decimal("100"):
            raise HTTPException(status_code=400, detail="Discount percentage must be between 0 and 100.")
        new_discount = round_money((subtotal * req.discount_percent) / Decimal("100.00"))
    elif req.discount_amount is not None:
        if req.discount_amount < Decimal("0"):
            raise HTTPException(status_code=400, detail="Discount amount cannot be negative.")
        new_discount = min(subtotal, round_money(req.discount_amount))

    order.discount = new_discount
    OrderService.recalculate_order_bill(db, order)
    db.commit()
    db.refresh(order)

    await ws_manager.broadcast_to_restaurant(
        current_user.restaurant_id,
        create_ws_message(WSEventType.ORDER_UPDATED, {"order_id": order.id, "table_id": table_id, "total": float(order.total_amount)})
    )
    return order

@router.patch("/tables/{table_id}/order/mode", response_model=OrderResponse)
async def update_table_order_mode(
    table_id: str,
    req: UpdateOrderModeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Persist order mode (dine-in, takeaway, delivery) on the active table order."""
    clean_mode = req.mode.strip().lower().replace("_", "-")
    if clean_mode not in [m.value for m in OrderMode]:
        raise HTTPException(status_code=400, detail=f"Invalid order mode '{req.mode}'.")

    order = OrderService.get_or_create_table_order(db, current_user.restaurant_id, table_id, placed_by=PlacedBy.POS)
    order.mode = OrderMode(clean_mode)
    if req.delivery_address is not None:
        order.delivery_address = req.delivery_address.strip() or None
    db.commit()
    db.refresh(order)

    await ws_manager.broadcast_to_restaurant(
        current_user.restaurant_id,
        create_ws_message(WSEventType.ORDER_UPDATED, {"order_id": order.id, "table_id": table_id, "mode": order.mode.value})
    )
    return order

@router.post("/tables/{table_id}/fire-kot", response_model=KOTResponse)
async def fire_table_kot(
    table_id: str,
    req: FireKOTRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        order = OrderService.get_or_create_table_order(db, current_user.restaurant_id, table_id, placed_by=PlacedBy.POS)
        if req.customer_name and req.customer_name.strip():
            order.customer_name = req.customer_name.strip()
        if req.customer_phone and req.customer_phone.strip():
            order.customer_phone = req.customer_phone.strip()
        if req.mode:
            clean_mode = req.mode.lower().replace("_", "-")
            if clean_mode in [m.value for m in OrderMode]:
                order.mode = OrderMode(clean_mode)
        if req.delivery_address is not None:
            order.delivery_address = req.delivery_address.strip() or None
        db.commit()
        kot = OrderService.fire_kot(db, order.id, req.captain_notes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await ws_manager.broadcast_to_restaurant(
        current_user.restaurant_id,
        create_ws_message(WSEventType.KOT_CREATED, {
            "kot_id": kot.id,
            "kot_number": kot.kot_number,
            "table_id": kot.table_id,
            "items_count": len(kot.items)
        })
    )
    return kot

@router.post("/tables/{table_id}/cancel-order", response_model=TableResponse)
async def cancel_table_order_endpoint(
    table_id: str,
    req: Optional[CancelTableOrderRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Safely cancels an accidental, abandoned, or empty active order and frees the table to VACANT.
    Does NOT fabricate a sale, payment, or loyalty points.
    """
    reason = req.reason if req and req.reason else "Cancelled by staff"
    try:
        table = OrderService.cancel_table_order(
            db, current_user.restaurant_id, table_id, reason=reason
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await ws_manager.broadcast_to_restaurant(
        current_user.restaurant_id,
        create_ws_message(WSEventType.TABLE_UPDATED, {
            "table_id": table_id,
            "status": "vacant",
            "current_bill": 0.0,
            "opened_at": None
        })
    )
    return table

@router.post("/tables/{table_id}/settle", response_model=OrderResponse)
async def settle_table_bill(
    table_id: str,
    req: BillSettlementRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    table = (
        db.query(DiningTable)
        .filter(DiningTable.id == table_id, DiningTable.restaurant_id == current_user.restaurant_id)
        .with_for_update()
        .first()
    )
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    if not table.current_order_id:
        raise HTTPException(status_code=409, detail="Table has no active order to settle or bill was already settled")
        
    order = (
        db.query(Order)
        .filter(Order.id == table.current_order_id, Order.restaurant_id == current_user.restaurant_id)
        .with_for_update()
        .execution_options(populate_existing=True)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not order.items:
        raise HTTPException(status_code=400, detail="Cannot settle an empty order")
    if req.discount_amount is not None and req.discount_amount > Decimal("0.00") and order.discount == Decimal("0.00"):
        from app.services.billing_service import round_money
        order.discount = min(order.subtotal, round_money(req.discount_amount))
        OrderService.recalculate_order_bill(db, order)
        db.flush()
    try:
        order = OrderService.settle_bill(
            db,
            order.id,
            payment_method=req.payment_method,
            discount_amount=req.discount_amount or Decimal("0.00"),
            complimentary_reason=req.complimentary_reason
        )
    except ValueError as e:
        msg = str(e)
        if "already been settled" in msg or "already settled" in msg or "paid" in msg:
            raise HTTPException(status_code=409, detail=msg)
        raise HTTPException(status_code=400, detail=msg)

    await ws_manager.broadcast_to_restaurant(
        current_user.restaurant_id,
        create_ws_message(WSEventType.TABLE_UPDATED, {"table_id": table_id, "status": "vacant", "current_bill": 0.0})
    )
    return order
