from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.user import User
from app.models.order import Order, OrderMode, OrderStatus
from app.schemas.delivery import (
    DeliveryOrderResponse, DispatchOrderRequest,
    VerifyOTPRequest, VerifyOTPResponse
)
from app.services.delivery_service import DeliveryService
from app.api.deps import check_permission

router = APIRouter()

@router.get("/orders", response_model=List[DeliveryOrderResponse])
def get_delivery_orders(
    status: Optional[str] = Query(None, description="Filter by delivery status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("delivery:read"))
):
    query = db.query(Order).filter(
        Order.restaurant_id == current_user.restaurant_id,
        Order.mode.in_([OrderMode.DELIVERY, OrderMode.TAKEAWAY, OrderMode.ZOMATO, OrderMode.SWIGGY, OrderMode.UBEREATS, OrderMode.DOORDASH])
    )

    if status and status.lower() != "all":
        try:
            target_status = OrderStatus(status.lower())
            query = query.filter(Order.status == target_status)
        except ValueError:
            pass

    orders = query.order_by(Order.created_at.desc()).limit(50).all()

    res = []
    for o in orders:
        summary_items = [f"{it.quantity}x {it.name}" for it in o.items] if o.items else []
        items_summary = ", ".join(summary_items) if summary_items else "Standard Delivery Package"

        item = DeliveryOrderResponse(
            id=o.id,
            restaurant_id=o.restaurant_id,
            order_number=o.order_number,
            token_number=o.token_number,
            customer_name=o.customer_name or "Delivery Guest",
            customer_phone=o.customer_phone or "Unspecified",
            delivery_address=o.delivery_address or "Standard Direct Delivery",
            mode=o.mode,
            status=o.status,
            payment_status=o.payment_status.value if o.payment_status else "pending",
            total_amount=o.total_amount,
            items_summary=items_summary,
            rider_name=o.aggregator_rider_name,
            rider_phone=None,
            dispatch_time=o.dispatch_time,
            delivered_time=o.delivered_time,
            aggregator_platform=o.aggregator_platform,
            aggregator_rider_name=o.aggregator_rider_name,
            aggregator_rider_status=o.aggregator_rider_status,
            has_otp=bool(o.delivery_otp_hash),
            otp_verified=bool(o.delivery_otp_verified_at),
            created_at=o.created_at
        )
        res.append(item)
    return res

@router.post("/orders/{order_id}/dispatch")
def dispatch_delivery_order(
    order_id: str,
    req: DispatchOrderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("delivery:dispatch"))
):
    order, plain_otp = DeliveryService.dispatch_order(
        db, order_id, current_user.restaurant_id, req.rider_name, req.rider_phone
    )
    return {
        "status": "success",
        "message": f"Order #{order.order_number} dispatched to rider {req.rider_name}",
        "order_id": order.id,
        "dispatch_time": order.dispatch_time,
        "delivery_otp": plain_otp,
        "otp_for_customer": plain_otp  # Returned once to dispatcher for SMS/WhatsApp alert
    }

@router.post("/orders/{order_id}/verify-otp", response_model=VerifyOTPResponse)
def verify_delivery_handover_otp(
    order_id: str,
    req: VerifyOTPRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("delivery:dispatch"))
):
    order = DeliveryService.verify_handover_otp(
        db, order_id, current_user.restaurant_id, req.otp
    )
    return VerifyOTPResponse(
        status="verified",
        message=f"Order #{order.order_number} handover verified and marked completed.",
        order_id=order.id,
        delivered_at=order.delivered_time or datetime.now(timezone.utc)
    )
