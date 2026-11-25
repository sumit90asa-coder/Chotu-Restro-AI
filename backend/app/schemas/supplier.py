from typing import Optional, List, Any
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, ConfigDict, model_validator
from app.models.supplier import PurchaseOrderStatus

class SupplierCreate(BaseModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    is_active: Optional[bool] = None

class SupplierResponse(BaseModel):
    id: str
    restaurant_id: str
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    gst_number: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class PurchaseOrderItemCreate(BaseModel):
    ingredient_id: str
    quantity: Optional[Decimal] = None
    ordered_quantity: Optional[Decimal] = None
    unit_cost: Decimal

    @model_validator(mode="before")
    @classmethod
    def populate_quantity(cls, data: Any) -> Any:
        if isinstance(data, dict):
            q = data.get("quantity") if data.get("quantity") is not None else data.get("ordered_quantity")
            if q is not None:
                data["quantity"] = q
                data["ordered_quantity"] = q
        elif hasattr(data, "__dict__"):
            q = getattr(data, "quantity", None) if getattr(data, "quantity", None) is not None else getattr(data, "ordered_quantity", None)
            if q is not None:
                try:
                    setattr(data, "quantity", q)
                    setattr(data, "ordered_quantity", q)
                except Exception:
                    pass
        return data

class PurchaseOrderItemResponse(BaseModel):
    id: str
    ingredient_id: str
    quantity: Decimal
    unit_cost: Decimal
    total_cost: Decimal

    model_config = ConfigDict(from_attributes=True)

class PurchaseOrderCreate(BaseModel):
    supplier_id: str
    notes: Optional[str] = None
    items: List[PurchaseOrderItemCreate]

class PurchaseOrderResponse(BaseModel):
    id: str
    restaurant_id: str
    supplier_id: str
    po_number: str
    status: PurchaseOrderStatus
    total_amount: Decimal
    invoice_ref: Optional[str] = None
    notes: Optional[str] = None
    issued_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    created_at: datetime
    items: List[PurchaseOrderItemResponse] = []

    model_config = ConfigDict(from_attributes=True)

class ReceivePORequest(BaseModel):
    invoice_ref: Optional[str] = None
    invoice_number: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def populate_invoice_ref(cls, data: Any) -> Any:
        if isinstance(data, dict):
            ref = data.get("invoice_ref") or data.get("invoice_number")
            if ref:
                data["invoice_ref"] = ref
        elif hasattr(data, "__dict__"):
            ref = getattr(data, "invoice_ref", None) or getattr(data, "invoice_number", None)
            if ref:
                try:
                    setattr(data, "invoice_ref", ref)
                except Exception:
                    pass
        return data
