from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field

class CouponCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = None
    discount_type: str = Field(default="percentage")  # "percentage" or "flat"
    discount_value: Decimal = Field(..., gt=0)
    min_order_value: Decimal = Field(default=Decimal("0.00"), ge=0)
    max_discount: Optional[Decimal] = None
    usage_limit: int = Field(default=1000, gt=0)
    expires_at: Optional[datetime] = None

class CouponUpdate(BaseModel):
    description: Optional[str] = None
    is_active: Optional[bool] = None
    min_order_value: Optional[Decimal] = None
    max_discount: Optional[Decimal] = None
    usage_limit: Optional[int] = None

class CouponResponse(BaseModel):
    id: str
    restaurant_id: str
    code: str
    description: Optional[str] = None
    discount_type: str
    discount_value: float
    min_order_value: float
    max_discount: Optional[float] = None
    usage_limit: int
    used_count: int
    is_active: bool
    expires_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CouponValidateRequest(BaseModel):
    code: str
    subtotal: Decimal

class CouponValidateResponse(BaseModel):
    valid: bool
    code: str
    discount_type: str
    discount_value: float
    discount_amount: float
    final_subtotal: float
    message: str
