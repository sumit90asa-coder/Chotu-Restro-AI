from typing import List, Optional
import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.table import DiningTable, TableStatus
from app.schemas.menu import TableResponse, TableStatusUpdate, TableTransferRequest, TableWaiterAssignRequest
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
    if status_update.captain_name is not None:
        table.captain_name = status_update.captain_name
    db.commit()
    db.refresh(table)
    
    # Broadcast to WebSockets
    await ws_manager.broadcast_to_restaurant(
        current_user.restaurant_id,
        create_ws_message(WSEventType.TABLE_UPDATED, {"table_id": table.id, "status": table.status.value})
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
