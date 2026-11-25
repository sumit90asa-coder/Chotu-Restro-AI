from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, EmailStr, Field
from app.core.permissions import UserRole

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    restaurant_id: str
    full_name: str
    restaurant_name: Optional[str] = None

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    restaurant_id: Optional[str] = None

class LoginRequest(BaseModel):
    identifier: Optional[str] = None  # Accepts Email or Mobile Phone
    email: Optional[EmailStr] = None  # Backward-compatible
    password: str

class RegisterRequest(BaseModel):
    # Owner Details
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=7, max_length=20)
    password: str = Field(..., min_length=8)
    
    # Restaurant Details
    restaurant_name: str = Field(..., min_length=2, max_length=150)
    restaurant_type: Optional[str] = "dinein"  # qsr, cafe, dinein, cloud
    address: str = Field(..., min_length=3)
    city: str = Field(default="Mumbai", min_length=2)
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: str = "India"
    
    # Compliance & Business Config
    gstin: Optional[str] = None
    fssai_number: Optional[str] = None
    business_hours: Optional[str] = "11:00 AM - 11:00 PM"
    upi_vpa: Optional[str] = None
    invoice_prefix: Optional[str] = None

class RegisterResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    restaurant_id: str
    restaurant_name: str
    full_name: str
    email: str
    phone: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole = UserRole.CASHIER
    restaurant_id: str
    phone: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    restaurant_id: str
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool
    phone: Optional[str] = None

    class Config:
        from_attributes = True
