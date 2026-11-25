from typing import List, Optional, Any
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, model_validator
from app.models.order import OrderMode, OrderStatus, PaymentStatus, PlacedBy
from app.models.menu import DietaryType, StationType

class OrderItemCreate(BaseModel):
    dish_id: str
    name: str
    price: Decimal
    quantity: int = 1
    dietary: DietaryType = DietaryType.NONVEG
    station: StationType = StationType.CURRY
    notes: Optional[str] = None

class OrderItemResponse(BaseModel):
    id: str
    menu_item_id: str
    dish_id: Optional[str] = None
    name: str
    price: Decimal
    unit_price: Optional[Decimal] = None
    quantity: int
    dietary: DietaryType
    station: StationType
    notes: Optional[str] = None
    status: str

    class Config:
        from_attributes = True

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if hasattr(data, "__dict__"):
            dish_val = getattr(data, "dish_id", None) or getattr(data, "menu_item_id", None)
            price_val = getattr(data, "unit_price", None) or getattr(data, "price", None)
            try:
                setattr(data, "dish_id", dish_val)
            except Exception:
                pass
            try:
                setattr(data, "unit_price", price_val)
            except Exception:
                pass
        elif isinstance(data, dict):
            dish_val = data.get("dish_id") or data.get("menu_item_id")
            price_val = data.get("unit_price") or data.get("price")
            data["dish_id"] = dish_val
            data["unit_price"] = price_val
        return data

class OrderCreate(BaseModel):
    table_id: Optional[str] = None
    customer_name: Optional[str] = "Guest"
    customer_phone: Optional[str] = None
    mode: OrderMode = OrderMode.DINE_IN
    delivery_address: Optional[str] = None
    placed_by: PlacedBy = PlacedBy.POS
    items: List[OrderItemCreate]

class OrderResponse(BaseModel):
    id: str
    restaurant_id: str
    table_id: Optional[str] = None
    order_number: str
    token_number: str
    customer_name: str
    customer_phone: Optional[str] = None
    mode: OrderMode
    delivery_address: Optional[str] = None
    status: OrderStatus
    payment_status: PaymentStatus
    placed_by: PlacedBy
    
    subtotal: Decimal
    cgst: Decimal
    sgst: Decimal
    service_charge: Decimal
    discount: Decimal
    total_amount: Decimal
    
    aggregator_platform: Optional[str] = None
    aggregator_order_id: Optional[str] = None
    aggregator_rider_name: Optional[str] = None
    aggregator_rider_status: Optional[str] = None
    aggregator_otp: Optional[str] = None
    
    created_at: datetime
    items: List[OrderItemResponse] = []

    class Config:
        from_attributes = True

class OrderStatusUpdate(BaseModel):
    status: OrderStatus

class BillSettlementRequest(BaseModel):
    payment_method: str = "cash"  # cash, upi, card
    notes: Optional[str] = None
