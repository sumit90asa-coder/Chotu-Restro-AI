from typing import List, Optional, Any
from decimal import Decimal
from pydantic import BaseModel, model_validator
from app.models.table import TableStatus
from app.models.menu import DietaryType, StationType

class TableResponse(BaseModel):
    id: str
    restaurant_id: str
    label: str
    floor_name: Optional[str] = "Main AC Hall"
    capacity: int
    status: TableStatus
    qr_token: str
    current_order_id: Optional[str] = None
    captain_name: Optional[str] = None
    current_bill: Decimal
    opened_at: Optional[str] = None
    assigned_waiter_id: Optional[str] = None

    class Config:
        from_attributes = True

class TableCreate(BaseModel):
    label: str
    capacity: int = 4
    floor_name: str = "Main AC Hall"

class TableUpdate(BaseModel):
    label: Optional[str] = None
    capacity: Optional[int] = None
    floor_name: Optional[str] = None

class TableStatusUpdate(BaseModel):
    status: TableStatus
    captain_name: Optional[str] = None

class TableTransferRequest(BaseModel):
    target_table_id: str

class TableWaiterAssignRequest(BaseModel):
    waiter_id: Optional[str] = None

class MenuItemVariantResponse(BaseModel):
    id: str
    menu_item_id: str
    name: str
    price: Decimal
    is_in_stock: bool

    class Config:
        from_attributes = True

class MenuItemVariantCreate(BaseModel):
    name: str
    price: Decimal
    is_in_stock: bool = True

class MenuItemCreate(BaseModel):
    category_id: Optional[str] = None
    category: Optional[str] = None
    name: str
    description: Optional[str] = None
    price: Decimal
    dietary: DietaryType = DietaryType.VEG
    station: StationType = StationType.CURRY
    spice_level: int = 1
    is_bestseller: bool = False
    photo_url: Optional[str] = None
    preparation_time_minutes: int = 15

class MenuItemResponse(BaseModel):
    id: str
    restaurant_id: str
    category_id: str
    name: str
    description: Optional[str] = None
    price: Decimal
    dietary: DietaryType
    station: StationType
    spice_level: int
    is_bestseller: bool
    bestseller: Optional[bool] = None
    is_in_stock: bool
    is_active: bool
    photo_url: Optional[str] = None
    preparation_time_minutes: int = 15
    variants: List[MenuItemVariantResponse] = []

    class Config:
        from_attributes = True

    @model_validator(mode="after")
    def set_bestseller(self) -> "MenuItemResponse":
        if self.bestseller is None:
            self.bestseller = self.is_bestseller
        return self

class MenuCategoryResponse(BaseModel):
    id: str
    name: str
    slug: str
    display_order: int
    items: List[MenuItemResponse] = []

    class Config:
        from_attributes = True

class StockStatusUpdate(BaseModel):
    is_in_stock: bool

class MenuItemUpdate(BaseModel):
    is_in_stock: Optional[bool] = None
    price: Optional[Decimal] = None
