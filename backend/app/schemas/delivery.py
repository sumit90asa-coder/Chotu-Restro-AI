from typing import Optional, List
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.order import OrderMode, OrderStatus

class DispatchOrderRequest(BaseModel):
    rider_name: str
    rider_phone: str
    notes: Optional[str] = None

class VerifyOTPRequest(BaseModel):
    otp: str

class ManagerOverrideRequest(BaseModel):
    reason: Optional[str] = "Manager verified customer handover manually"

class VerifyOTPResponse(BaseModel):
    status: str
    message: str
    order_id: str
    delivered_at: datetime

class DeliveryOrderResponse(BaseModel):
    id: str
    restaurant_id: str
    order_number: str
    token_number: str
    customer_name: str
    customer_phone: Optional[str] = None
    delivery_address: Optional[str] = None
    mode: OrderMode
    status: OrderStatus
    payment_status: Optional[str] = "pending"
    total_amount: Decimal
    items_summary: Optional[str] = ""
    rider_name: Optional[str] = None
    rider_phone: Optional[str] = None
    dispatch_time: Optional[datetime] = None
    delivered_time: Optional[datetime] = None
    aggregator_platform: Optional[str] = None
    aggregator_rider_name: Optional[str] = None
    aggregator_rider_status: Optional[str] = None
    has_otp: bool = False
    otp_verified: bool = False
    otp_attempts: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
