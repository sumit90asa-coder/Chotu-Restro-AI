from typing import List, Optional, Any
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, field_validator
from app.models.inventory import TransactionType

class IngredientCreate(BaseModel):
    name: str
    unit: str = "kg"
    current_stock: Decimal = Decimal("0.000")
    reorder_threshold: Decimal = Decimal("5.000")
    cost_per_unit: Decimal = Decimal("0.00")
    supplier_name: Optional[str] = None

class IngredientResponse(BaseModel):
    id: str
    restaurant_id: str
    name: str
    unit: str
    current_stock: Decimal
    reorder_threshold: Decimal
    cost_per_unit: Decimal
    supplier_name: Optional[str] = None
    is_low_stock: bool = False

    class Config:
        from_attributes = True

class StockAdjustment(BaseModel):
    quantity: Decimal  # positive for adding, negative for deduction
    transaction_type: str = "adjustment"
    notes: Optional[str] = None

    @field_validator("transaction_type", mode="before")
    @classmethod
    def normalize_transaction_type(cls, v: Any) -> str:
        s = str(v).lower().strip()
        if s in ("intake", "purchase"):
            return TransactionType.PURCHASE.value
        if s == "consumption":
            return TransactionType.CONSUMPTION.value
        if s == "wastage":
            return TransactionType.WASTAGE.value
        return TransactionType.ADJUSTMENT.value

class StockTransactionResponse(BaseModel):
    id: str
    ingredient_id: str
    transaction_type: TransactionType
    quantity: Decimal
    reference_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class RecipeLink(BaseModel):
    menu_item_id: str
    ingredient_id: str
    quantity_required: Decimal
