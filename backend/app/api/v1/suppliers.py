from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.user import User
from app.models.supplier import Supplier, PurchaseOrder
from app.schemas.supplier import (
    SupplierCreate, SupplierUpdate, SupplierResponse,
    PurchaseOrderCreate, PurchaseOrderResponse, ReceivePORequest
)
from app.services.supplier_service import SupplierService
from app.api.deps import check_permission
import uuid

router = APIRouter()

@router.get("", response_model=List[SupplierResponse])
def get_suppliers(
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("suppliers:read"))
):
    return db.query(Supplier).filter(
        Supplier.restaurant_id == current_user.restaurant_id
    ).order_by(Supplier.name).all()

@router.post("", response_model=SupplierResponse)
def create_supplier(
    req: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("suppliers:write"))
):
    sup = Supplier(
        id=f"sup-{uuid.uuid4().hex[:8]}",
        restaurant_id=current_user.restaurant_id,
        name=req.name,
        contact_person=req.contact_person,
        phone=req.phone,
        email=req.email,
        address=req.address,
        gst_number=req.gst_number,
        is_active=True
    )
    db.add(sup)
    db.commit()
    db.refresh(sup)
    return sup

@router.put("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: str,
    req: SupplierUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("suppliers:write"))
):
    sup = db.query(Supplier).filter(
        Supplier.id == supplier_id,
        Supplier.restaurant_id == current_user.restaurant_id
    ).first()
    if not sup:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    if req.name is not None:
        sup.name = req.name.strip()
    if req.contact_person is not None:
        sup.contact_person = req.contact_person.strip()
    if req.phone is not None:
        sup.phone = req.phone.strip()
    if req.email is not None:
        sup.email = req.email.strip()
    if req.address is not None:
        sup.address = req.address.strip()
    if req.gst_number is not None:
        sup.gst_number = req.gst_number.strip()
    if req.is_active is not None:
        sup.is_active = req.is_active
        
    db.commit()
    db.refresh(sup)
    return sup

@router.delete("/{supplier_id}", status_code=200)
def delete_supplier(
    supplier_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("suppliers:write"))
):
    sup = db.query(Supplier).filter(
        Supplier.id == supplier_id,
        Supplier.restaurant_id == current_user.restaurant_id
    ).first()
    if not sup:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    # Check if supplier has purchase orders
    has_pos = db.query(PurchaseOrder).filter(PurchaseOrder.supplier_id == supplier_id).first()
    if has_pos:
        sup.is_active = False
        db.commit()
        return {"success": True, "message": f"Supplier '{sup.name}' has historical purchase orders and was deactivated."}
    else:
        db.delete(sup)
        db.commit()
        return {"success": True, "message": f"Supplier '{sup.name}' deleted successfully."}

@router.get("/purchase-orders", response_model=List[PurchaseOrderResponse])
def get_purchase_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("suppliers:read"))
):
    return db.query(PurchaseOrder).filter(
        PurchaseOrder.restaurant_id == current_user.restaurant_id
    ).order_by(PurchaseOrder.created_at.desc()).limit(50).all()

@router.post("/purchase-orders", response_model=PurchaseOrderResponse)
def create_purchase_order(
    req: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("suppliers:write"))
):
    items_data = [it.model_dump() for it in req.items]
    po = SupplierService.create_purchase_order(
        db, current_user.restaurant_id, req.supplier_id, items_data, req.notes or ""
    )
    return po

@router.post("/purchase-orders/{po_id}/receive", response_model=PurchaseOrderResponse)
def receive_purchase_order(
    po_id: str,
    req: ReceivePORequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("suppliers:write"))
):
    po = SupplierService.receive_purchase_order(
        db, po_id, current_user.restaurant_id, req.invoice_ref, req.notes or ""
    )
    return po
