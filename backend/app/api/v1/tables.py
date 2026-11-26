from typing import List, Optional
import uuid
import secrets
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.table import DiningTable, TableStatus
from app.models.order import Order, OrderStatus, PaymentStatus, PlacedBy
from app.schemas.menu import TableResponse, TableStatusUpdate, TableTransferRequest, TableWaiterAssignRequest, TableCreate, TableUpdate
from app.services.order_service import OrderService
from app.api.deps import get_current_user, check_permission
from app.models.user import User
from app.core.permissions import UserRole
from app.websocket.manager import ws_manager
from app.websocket.events import WSEventType, create_ws_message

router = APIRouter()

@router.get("", response_model=List[TableResponse])
def get_tables(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(DiningTable).filter(DiningTable.restaurant_id == current_user.restaurant_id).order_by(DiningTable.label).all()

@router.get("/floors/all", response_model=List[str])
def get_restaurant_floors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rows = db.query(DiningTable.floor_name).filter(
        DiningTable.restaurant_id == current_user.restaurant_id
    ).distinct().all()
    floors = sorted(list({r[0] for r in rows if r[0]}))
    if not floors:
        floors = ["Main AC Hall"]
    return floors

@router.post("", response_model=TableResponse, status_code=status.HTTP_201_CREATED)
async def create_table(
    req: TableCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    clean_label = req.label.strip()
    dup = db.query(DiningTable).filter(
        DiningTable.restaurant_id == current_user.restaurant_id,
        DiningTable.label.ilike(clean_label)
    ).first()
    if dup:
        raise HTTPException(status_code=400, detail=f"Table with label '{clean_label}' already exists.")

    table_id = f"tbl-{uuid.uuid4().hex[:8]}"
    qr_token = f"chotu_qr_{secrets.token_urlsafe(32)}"
    table = DiningTable(
        id=table_id,
        restaurant_id=current_user.restaurant_id,
        label=clean_label,
        capacity=req.capacity,
        floor_name=req.floor_name.strip() if req.floor_name else "Main AC Hall",
        status=TableStatus.VACANT,
        qr_token=qr_token,
        current_bill=Decimal("0.00"),
    )
    db.add(table)
    db.commit()
    db.refresh(table)
    
    await ws_manager.broadcast_to_restaurant(
        current_user.restaurant_id,
        create_ws_message(WSEventType.TABLE_UPDATED, {"table_id": table.id, "status": table.status.value})
    )
    return table

@router.get("/{table_id}", response_model=TableResponse)
def get_table(
    table_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    table = db.query(DiningTable).filter(DiningTable.id == table_id, DiningTable.restaurant_id == current_user.restaurant_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    return table

@router.put("/{table_id}", response_model=TableResponse)
async def update_table(
    table_id: str,
    req: TableUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    table = db.query(DiningTable).filter(
        DiningTable.id == table_id,
        DiningTable.restaurant_id == current_user.restaurant_id
    ).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    if req.label is not None:
        table.label = req.label.strip()
    if req.capacity is not None:
        table.capacity = req.capacity
    if req.floor_name is not None:
        table.floor_name = req.floor_name.strip()
    
    db.commit()
    db.refresh(table)
    return table

@router.delete("/{table_id}", status_code=status.HTTP_200_OK)
async def delete_table(
    table_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    table = db.query(DiningTable).filter(
        DiningTable.id == table_id,
        DiningTable.restaurant_id == current_user.restaurant_id
    ).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    if table.status != TableStatus.VACANT or table.current_order_id:
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete an active, occupied, or unbilled table. Settle or clear it first."
        )
        
    db.delete(table)
    db.commit()
    return {"success": True, "message": f"Table {table.label} deleted successfully"}

@router.patch("/{table_id}/status", response_model=TableResponse)
async def update_table_status(
    table_id: str,
    status_update: TableStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    table = db.query(DiningTable).filter(DiningTable.id == table_id, DiningTable.restaurant_id == current_user.restaurant_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
        
    table.status = status_update.status
    
    if status_update.status == TableStatus.VACANT:
        # Complete clean reset of table state & cancel any unsettled active order
        if table.current_order_id:
            old_order = db.query(Order).filter(
                Order.id == table.current_order_id,
                Order.restaurant_id == current_user.restaurant_id
            ).first()
            if old_order and old_order.payment_status != PaymentStatus.PAID and old_order.status != OrderStatus.COMPLETED:
                old_order.status = OrderStatus.CANCELLED
        table.current_order_id = None
        table.current_bill = Decimal("0.00")
        table.opened_at = None
        table.captain_name = None
        table.assigned_waiter_id = None
    elif status_update.status == TableStatus.OCCUPIED:
        if not table.opened_at:
            table.opened_at = datetime.now(timezone.utc).strftime("%H:%M")
        if status_update.captain_name is not None:
            table.captain_name = status_update.captain_name
        # Establish authoritative active order relationship immediately
        if not table.current_order_id:
            active_order = OrderService.get_or_create_table_order(
                db, current_user.restaurant_id, table.id,
                customer_name=table.captain_name or f"Table {table.label} Guest",
                placed_by=PlacedBy.POS
            )
            table.current_order_id = active_order.id
    elif status_update.captain_name is not None:
        table.captain_name = status_update.captain_name

    db.commit()
    db.refresh(table)
    
    # Broadcast to WebSockets
    await ws_manager.broadcast_to_restaurant(
        current_user.restaurant_id,
        create_ws_message(WSEventType.TABLE_UPDATED, {
            "table_id": table.id, 
            "status": table.status.value,
            "current_bill": float(table.current_bill),
            "opened_at": table.opened_at
        })
    )
    return table

@router.post("/{table_id}/transfer", response_model=TableResponse)
async def transfer_table(
    table_id: str,
    req: TableTransferRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        target_table = OrderService.transfer_table(db, current_user.restaurant_id, table_id, req.target_table_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await ws_manager.broadcast_to_restaurant(
        current_user.restaurant_id,
        create_ws_message(WSEventType.TABLE_UPDATED, {"table_id": table_id, "status": TableStatus.VACANT.value})
    )
    await ws_manager.broadcast_to_restaurant(
        current_user.restaurant_id,
        create_ws_message(WSEventType.TABLE_UPDATED, {"table_id": target_table.id, "status": target_table.status.value})
    )
    return target_table

@router.post("/{table_id}/waiter", response_model=TableResponse)
async def assign_table_waiter(
    table_id: str,
    req: TableWaiterAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    table = db.query(DiningTable).filter(DiningTable.id == table_id, DiningTable.restaurant_id == current_user.restaurant_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
        
    if req.waiter_id:
        waiter = db.query(User).filter(User.id == req.waiter_id, User.restaurant_id == current_user.restaurant_id).first()
        if not waiter:
            raise HTTPException(status_code=400, detail="Assigned waiter not found")
        table.assigned_waiter_id = waiter.id
        table.captain_name = waiter.full_name
    else:
        table.assigned_waiter_id = None

    db.commit()
    db.refresh(table)
    await ws_manager.broadcast_to_restaurant(
        current_user.restaurant_id,
        create_ws_message(WSEventType.TABLE_UPDATED, {"table_id": table_id, "assigned_waiter_id": table.assigned_waiter_id})
    )
    return table

@router.post("/{table_id}/regenerate-qr", response_model=TableResponse)
async def regenerate_table_qr(
    table_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Strict server-side RBAC: Only OWNER and MANAGER are authorized to regenerate table QR codes
    if current_user.role not in [UserRole.OWNER, UserRole.MANAGER]:
        raise HTTPException(
            status_code=403,
            detail=f"Forbidden: Role '{current_user.role.value}' is not authorized to regenerate table QR codes. Only Owner and Manager are permitted."
        )

    table = db.query(DiningTable).filter(
        DiningTable.id == table_id,
        DiningTable.restaurant_id == current_user.restaurant_id
    ).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
        
    try:
        # Cryptographically secure token with 256 bits of entropy (32 urlsafe bytes)
        new_token = f"chotu_qr_{secrets.token_urlsafe(32)}"
        table.qr_token = new_token
        db.commit()
        db.refresh(table)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to regenerate QR token")
    
    # Broadcast to WebSockets with ZERO plaintext secrets
    await ws_manager.broadcast_to_restaurant(
        current_user.restaurant_id,
        create_ws_message(WSEventType.TABLE_UPDATED, {
            "table_id": table.id,
            "status": table.status.value,
            "action": "qr_token_regenerated"
        })
    )
    return table
