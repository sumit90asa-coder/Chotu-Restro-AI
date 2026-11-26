from typing import Optional, List
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, ConfigDict, model_validator
from app.models.customer import LoyaltyTxType

class CustomerCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    marketing_consent: bool = True
    tags: Optional[str] = None

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    marketing_consent: Optional[bool] = None
    tags: Optional[str] = None

class CustomerResponse(BaseModel):
    id: str
    restaurant_id: str
    name: str
    phone: str
    email: Optional[str] = None
    total_orders: int = 0
    visit_count: Optional[int] = None
    total_spend: Decimal = Decimal("0.00")
    loyalty_points_balance: int = 0
    loyalty_points: Optional[int] = None
    marketing_consent: bool = True
    tags: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="after")
    def populate_aliases(self) -> "CustomerResponse":
        if self.visit_count is None:
            self.visit_count = self.total_orders
        if self.loyalty_points is None:
            self.loyalty_points = self.loyalty_points_balance
        return self

    model_config = ConfigDict(from_attributes=True)

class LoyaltyAdjustRequest(BaseModel):
    transaction_type: Optional[LoyaltyTxType] = LoyaltyTxType.ADJUSTMENT
    points: int
    notes: Optional[str] = None
    reason: Optional[str] = None
    idempotency_key: Optional[str] = None

class LoyaltyTransactionResponse(BaseModel):
    id: str
    customer_id: str
    transaction_type: LoyaltyTxType
    points: int
    balance_after: int
    reference_order_id: Optional[str] = None
    idempotency_key: str
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class FeedbackCreate(BaseModel):
    order_id: Optional[str] = None
    rating: int  # 1 to 5
    comment: Optional[str] = None

class FeedbackResponse(BaseModel):
    id: str
    customer_id: str
    order_id: Optional[str] = None
    rating: int
    comment: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
