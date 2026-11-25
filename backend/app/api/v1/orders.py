from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.order import Order, OrderStatus
from app.models.kot import KOT, KOTStatus
from app.schemas.order import OrderResponse, OrderStatusUpdate
from app.api.deps import get_current_user
from app.models.user import User
from app.websocket.manager import ws_manager
from app.websocket.events import WSEventType, create_ws_message

router = APIRouter()

@router.get("", response_model=List[OrderResponse])
def get_orders(
    status_filter: Optional[str] = None,
    mode_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Order).filter(Order.restaurant_id == current_user.restaurant_id)
    if status_filter == "active":
        query = query.filter(Order.status != OrderStatus.COMPLETED, Order.status != OrderStatus.CANCELLED)
    elif status_filter == "completed":
        query = query.filter(Order.status == OrderStatus.COMPLETED)
    
    if mode_filter and mode_filter != "all":
        query = query.filter(Order.mode == mode_filter)
        
    return query.order_by(Order.created_at.desc()).all()

@router.get("/{order_id}", response_model=OrderResponse)
def get_order_by_id(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = db.query(Order).filter(Order.id == order_id, Order.restaurant_id == current_user.restaurant_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.patch("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: str,
    status_data: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = db.query(Order).filter(Order.id == order_id, Order.restaurant_id == current_user.restaurant_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    order.status = status_data.status
    
    # When order is marked READY or COMPLETED, synchronize active KOTs
    if status_data.status in (OrderStatus.READY, OrderStatus.COMPLETED):
        kots = db.query(KOT).filter(KOT.order_id == order.id, KOT.status != KOTStatus.BUMPED).all()
        for k in kots:
            k.status = KOTStatus.BUMPED
            k.completed_at = datetime.now(timezone.utc)
            for it in k.items:
                it.is_prepared = True
        if kots:
            await ws_manager.broadcast_to_restaurant(
                current_user.restaurant_id,
                create_ws_message(WSEventType.KOT_UPDATED, {"order_id": order.id, "status": "bumped"})
            )

    db.commit()
    db.refresh(order)

    await ws_manager.broadcast_to_restaurant(
        current_user.restaurant_id,
        create_ws_message(WSEventType.ORDER_UPDATED, {"order_id": order.id, "status": order.status.value})
    )
    return order
