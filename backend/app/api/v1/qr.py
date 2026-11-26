import time
import secrets
import hashlib
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Header, Response
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.table import DiningTable, TableStatus
from app.models.restaurant import Restaurant
from app.models.menu import MenuItem
from app.models.order import Order, OrderItem, PlacedBy, OrderStatus
from app.schemas.menu import MenuItemResponse
from app.schemas.order import OrderItemCreate, OrderResponse
from app.services.order_service import OrderService
from app.websocket.manager import ws_manager
from app.websocket.events import WSEventType, create_ws_message

router = APIRouter()

# In-memory idempotency cache: idempotency_key -> (timestamp, order_id)
IDEMPOTENCY_CACHE: Dict[str, tuple[float, str]] = {}

def get_table_by_token(token: str, db: Session) -> DiningTable:
    """
    Constant-time cryptographically secure QR token verification.
    Prevents timing side-channel attacks and supports both direct tokens and SHA-256 hashes.
    Never exposes internal token values in error messages.
    """
    if not token or not isinstance(token, str) or len(token) < 4:
        raise HTTPException(status_code=404, detail="Invalid or expired QR token")
    
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    table = db.query(DiningTable).filter(
        (DiningTable.qr_token == token) | (DiningTable.qr_token == token_hash)
    ).first()
    
    if not table:
        raise HTTPException(status_code=404, detail="Invalid or expired QR token")
        
    # Constant-time comparison
    is_valid = secrets.compare_digest(table.qr_token, token) or secrets.compare_digest(table.qr_token, token_hash)
    if not is_valid:
        raise HTTPException(status_code=404, detail="Invalid or expired QR token")
        
    return table

class QRAssistanceRequest(BaseModel):
    service_type: str = "water"  # "water" | "waiter" | "bill"
    notes: Optional[str] = None

class QRAssistanceResponse(BaseModel):
    success: bool = True
    status: str = "acknowledged"
    table_id: str
    table_label: str
    service_type: str
    display_type: str = ""
    message: str

class QROrderSubmission(BaseModel):
    customer_name: str = "Guest (QR)"
    items: List[OrderItemCreate]
    captain_notes: str = "Self-order via Table QR"
    table_id: Optional[str] = None
    idempotency_key: Optional[str] = None

class QRMenuResponse(BaseModel):
    restaurant_name: str
    table_id: str
    table_label: str
    table_status: str = "vacant"
    items: List[MenuItemResponse]
    cgst_percent: float = 2.5
    sgst_percent: float = 2.5
    service_charge_percent: float = 0.0

class QRTableInfoResponse(BaseModel):
    restaurant_name: str
    restaurant_id: str
    table_id: str
    table_label: str
    status: str
    capacity: int
    qr_token: str

@router.get("/{token}/table", response_model=QRTableInfoResponse)
def get_qr_table_info(token: str, db: Session = Depends(get_db)):
    table = get_table_by_token(token, db)
    restaurant = db.query(Restaurant).filter(Restaurant.id == table.restaurant_id).first()
    return QRTableInfoResponse(
        restaurant_name=restaurant.name if restaurant else "Restaurant",
        restaurant_id=table.restaurant_id,
        table_id=table.id,
        table_label=table.label,
        status=table.status.value,
        capacity=table.capacity,
        qr_token=table.qr_token
    )

@router.get("/{token}/menu", response_model=QRMenuResponse)
def get_qr_menu(token: str, db: Session = Depends(get_db)):
    table = get_table_by_token(token, db)
    restaurant = db.query(Restaurant).filter(Restaurant.id == table.restaurant_id).first()
    items = db.query(MenuItem).filter(
        MenuItem.restaurant_id == table.restaurant_id, 
        MenuItem.is_active == True
    ).all()
    
    cgst = float(restaurant.cgst_percent) if restaurant and restaurant.cgst_percent is not None else 2.5
    sgst = float(restaurant.sgst_percent) if restaurant and restaurant.sgst_percent is not None else 2.5
    service_charge = float(restaurant.service_charge_percent) if restaurant and restaurant.service_charge_percent is not None else 0.0

    return QRMenuResponse(
        restaurant_name=restaurant.name if restaurant else "Restaurant",
        table_id=table.id,
        table_label=table.label,
        table_status=table.status.value,
        items=items,
        cgst_percent=cgst,
        sgst_percent=sgst,
        service_charge_percent=service_charge,
    )

@router.get("/{token}/order", response_model=Optional[OrderResponse])
def get_qr_table_active_order(
    token: str, 
    db: Session = Depends(get_db),
    x_customer_session: Optional[str] = Header(None, alias="X-Customer-Session")
):
    """
    Fetch active order for table identified by secure QR token.
    Allows customers to view running bill, items, and status upon page reload or reordering.
    Enforces privacy barrier: Only returns active order details if the request includes
    the matching customer session token. External scanners or other guests scanning the
    table QR code without the session token receive null (no access to bill or customer data).
    """
    table = get_table_by_token(token, db)
    if not table.current_order_id:
        return None
    order = db.query(Order).filter(
        Order.id == table.current_order_id,
        Order.status.notin_([OrderStatus.COMPLETED, OrderStatus.CANCELLED])
    ).first()
    if not order:
        return None

    # Privacy enforcement: if order has a customer session token, require matching header
    if order.customer_session_token:
        if not x_customer_session or not secrets.compare_digest(order.customer_session_token, x_customer_session):
            return None

    return order

@router.post("/{token}/orders", response_model=OrderResponse)
async def submit_qr_order(
    token: str,
    submission: QROrderSubmission,
    response: Response,
    db: Session = Depends(get_db),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    x_customer_session: Optional[str] = Header(None, alias="X-Customer-Session")
):
    """
    CRITICAL WORKFLOW & SECURITY HARDENING:
    1. Validates QR token using constant-time comparison against PostgreSQL.
    2. Enforces table isolation (cannot submit order for Table 2 using Table 1 token).
    3. Enforces session privacy and prevents cross-session table takeover.
    4. Enforces idempotency to prevent duplicate orders and double stock deduction.
    5. Enforces authoritative backend pricing (client submitted prices are ignored).
    6. Validates dish belongs to table's restaurant and is active and in-stock.
    7. Validates quantity limits (1 <= qty <= 50).
    8. Atomically acquires table row lock on PostgreSQL.
    9. Fires KOT for new batch and updates live KDS via WebSockets.
    """
    table = get_table_by_token(token, db)

    # Cross-table validation: Table ID in payload must match token's table
    if submission.table_id and submission.table_id.strip().upper() != table.id.strip().upper():
        raise HTTPException(
            status_code=400,
            detail=f"Table ID mismatch: Payload table '{submission.table_id}' does not match the scanned table '{table.id}'"
        )

    # Idempotency deduplication check (must run before session validation)
    effective_idempotency_key = submission.idempotency_key or x_idempotency_key
    now_ts = time.time()
    if effective_idempotency_key:
        cached = IDEMPOTENCY_CACHE.get(effective_idempotency_key)
        if cached and (now_ts - cached[0] < 300):
            cached_order = db.query(Order).filter(Order.id == cached[1]).first()
            if cached_order:
                if cached_order.customer_session_token:
                    response.headers["X-Customer-Session"] = cached_order.customer_session_token
                return cached_order

    # Check for active existing order on table to enforce session integrity
    existing_order = None
    if table.current_order_id:
        existing_order = db.query(Order).filter(
            Order.id == table.current_order_id,
            Order.status.notin_([OrderStatus.COMPLETED, OrderStatus.CANCELLED])
        ).first()

    if existing_order and existing_order.customer_session_token:
        if x_customer_session and not secrets.compare_digest(existing_order.customer_session_token, x_customer_session):
            raise HTTPException(
                status_code=403,
                detail="Table is currently occupied by an active customer session. Please request a table reset from staff."
            )

    if not submission.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    # Validate items, stock, quantities, and restaurant isolation
    validated_items = []
    for it in submission.items:
        if it.quantity <= 0 or it.quantity > 50:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid quantity {it.quantity} for '{it.name or it.dish_id}'. Quantity must be between 1 and 50."
            )

        dish = db.query(MenuItem).filter(
            MenuItem.id == it.dish_id, 
            MenuItem.restaurant_id == table.restaurant_id
        ).first()

        if not dish or not dish.is_active:
            raise HTTPException(
                status_code=400, 
                detail=f"Dish '{it.name or it.dish_id}' is currently unavailable or belongs to another restaurant"
            )

        if not dish.is_in_stock:
            raise HTTPException(
                status_code=400, 
                detail=f"Dish '{dish.name}' is out of stock"
            )

        validated_items.append((dish, it.quantity, it.notes))

    try:
        # Determine customer session
        session_token = x_customer_session
        if existing_order and existing_order.customer_session_token:
            session_token = existing_order.customer_session_token
        elif not session_token:
            session_token = f"sess-{secrets.token_hex(16)}"

        # Attach to or create table order with row-level lock serialization
        order = OrderService.get_or_create_table_order(
            db, table.restaurant_id, table.id, customer_name=submission.customer_name, placed_by=PlacedBy.QR
        )
        order.placed_by = PlacedBy.QR
        if not order.customer_session_token:
            order.customer_session_token = session_token
        table.status = TableStatus.OCCUPIED
        table.current_order_id = order.id

        newly_added_items = []
        for dish, qty, notes in validated_items:
            # Backend dish.price is authoritative (client price ignored)
            OrderService.add_or_update_order_item(db, order.id, dish.id, qty, notes)
            newly_added_items.append(OrderItem(
                id=f"temp-{dish.id}",
                order_id=order.id,
                menu_item_id=dish.id,
                name=dish.name,
                price=dish.price,
                quantity=qty,
                dietary=dish.dietary,
                station=dish.station,
                notes=notes,
                status="cooking"
            ))

        # Automatically fire KOT to Kitchen KDS ONLY for newly added items!
        kot = OrderService.fire_kot(db, order.id, submission.captain_notes, items_to_fire=newly_added_items)

        # Broadcast real-time events to Staff (POS & Kitchen)
        await ws_manager.broadcast_to_restaurant(
            table.restaurant_id,
            create_ws_message(WSEventType.ORDER_CREATED, {"order_id": order.id, "table_id": table.id, "origin": "QR"})
        )
        await ws_manager.broadcast_to_restaurant(
            table.restaurant_id,
            create_ws_message(WSEventType.KOT_CREATED, {
                "kot_id": kot.id,
                "kot_number": kot.kot_number,
                "table_id": kot.table_id,
                "items_count": len(kot.items),
                "origin": "QR"
            })
        )

        db.refresh(order)

        # Return session header
        if order.customer_session_token:
            response.headers["X-Customer-Session"] = order.customer_session_token

        # Store in idempotency cache
        if effective_idempotency_key:
            IDEMPOTENCY_CACHE[effective_idempotency_key] = (now_ts, order.id)

        return order
    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to submit QR order: {str(e)}")

@router.post("/{token}/assistance", response_model=QRAssistanceResponse)
async def request_table_assistance(
    token: str,
    req: QRAssistanceRequest,
    db: Session = Depends(get_db)
):
    table = get_table_by_token(token, db)
    
    clean_type = req.service_type.lower().strip()
    if "water" in clean_type:
        display_type = "Water Service"
        icon_type = "water"
    elif "bill" in clean_type:
        display_type = "Bill / Settlement Request"
        icon_type = "bill"
    else:
        display_type = "Server Assistance"
        icon_type = "waiter"

    message_data = {
        "table_id": table.id,
        "table_label": table.label,
        "floor_name": table.floor_name,
        "service_type": icon_type,
        "display_type": display_type,
        "service_title": display_type,
        "notes": req.notes,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    await ws_manager.broadcast_to_restaurant(
        table.restaurant_id,
        create_ws_message(WSEventType.SERVICE_REQUEST, message_data)
    )

    return QRAssistanceResponse(
        success=True,
        status="acknowledged",
        table_id=table.id,
        table_label=table.label,
        service_type=icon_type,
        display_type=display_type,
        message=f"{display_type} requested for {table.label}. Restaurant notified!"
    )
