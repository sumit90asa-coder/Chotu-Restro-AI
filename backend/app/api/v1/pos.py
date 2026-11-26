from datetime import datetime, timezone
from typing import List, Optional
from decimal import Decimal
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.order import Order, PlacedBy, OrderStatus, PaymentStatus, OrderMode
from app.models.table import DiningTable, TableStatus
from app.schemas.order import OrderResponse, BillSettlementRequest
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

@router.get("/tables/{table_id}/order", response_model=Optional[OrderResponse])
def get_table_order(
    table_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    CRITICAL: Pure read-only and idempotent. Returns current active order for this table,
    or None if table is vacant with no active session.
    """
    table = db.query(DiningTable).filter(
        DiningTable.id == table_id,
        DiningTable.restaurant_id == current_user.restaurant_id
    ).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
        
    def empty_draft_order(t: DiningTable):
        return OrderResponse(
            id=f"draft-{t.id}",
            restaurant_id=current_user.restaurant_id,
            table_id=t.id,
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

    if not table.current_order_id:
        return empty_draft_order(table)
        
    order = db.query(Order).filter(
        Order.id == table.current_order_id,
        Order.restaurant_id == current_user.restaurant_id
    ).first()
    
    if not order or order.status == OrderStatus.COMPLETED or order.payment_status == PaymentStatus.PAID:
        # Reset stale reference if order is completed
        table.current_order_id = None
        table.current_bill = Decimal("0.00")
        table.opened_at = None
        db.commit()
        return empty_draft_order(table)
        
    return order

@router.post("/tables/{table_id}/order/items", response_model=OrderResponse)
async def modify_table_order_item(
    table_id: str,
    req: ModifyItemRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = OrderService.get_or_create_table_order(db, current_user.restaurant_id, table_id, placed_by=PlacedBy.POS)
    order = OrderService.add_or_update_order_item(db, order.id, req.dish_id, req.delta_qty, req.notes)
    
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
    order = OrderService.get_or_create_table_order(db, current_user.restaurant_id, table_id, placed_by=PlacedBy.POS)
    order = OrderService.add_or_update_order_item(db, order.id, dish_id, delta_qty=-9999)
    await ws_manager.broadcast_to_restaurant(
        current_user.restaurant_id,
        create_ws_message(WSEventType.ORDER_UPDATED, {"order_id": order.id, "table_id": table_id, "total": float(order.total_amount)})
    )
    return order

@router.post("/tables/{table_id}/fire-kot", response_model=KOTResponse)
async def fire_table_kot(
    table_id: str,
    req: FireKOTRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = OrderService.get_or_create_table_order(db, current_user.restaurant_id, table_id, placed_by=PlacedBy.POS)
    if req.customer_name and req.customer_name.strip():
        order.customer_name = req.customer_name.strip()
    if req.customer_phone and req.customer_phone.strip():
        order.customer_phone = req.customer_phone.strip()
    if req.mode:
        clean_mode = req.mode.lower().replace("-", "_")
        if clean_mode in [m.value for m in OrderMode]:
            order.mode = OrderMode(clean_mode)
    db.commit()
    try:
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

@router.post("/tables/{table_id}/settle", response_model=OrderResponse)
async def settle_table_bill(
    table_id: str,
    req: BillSettlementRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    table = db.query(DiningTable).filter(DiningTable.id == table_id, DiningTable.restaurant_id == current_user.restaurant_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    if not table.current_order_id:
        raise HTTPException(status_code=400, detail="Table has no active order to settle")
    order = db.query(Order).filter(Order.id == table.current_order_id).first()
    if not order or not order.items:
        raise HTTPException(status_code=400, detail="Cannot settle an empty order")
    order = OrderService.settle_bill(db, order.id, req.payment_method)

    await ws_manager.broadcast_to_restaurant(
        current_user.restaurant_id,
        create_ws_message(WSEventType.TABLE_UPDATED, {"table_id": table_id, "status": "vacant"})
    )
    return order
