import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.user import User
from app.models.customer import Customer, LoyaltyTransaction, CustomerFeedback
from app.models.order import Order
from app.schemas.customer import (
    CustomerCreate, CustomerUpdate, CustomerResponse,
    LoyaltyAdjustRequest, LoyaltyTransactionResponse,
    FeedbackCreate, FeedbackResponse
)
from app.schemas.order import OrderResponse
from app.services.crm_service import CRMService, normalize_phone_number
from app.api.deps import check_permission

router = APIRouter()

@router.get("", response_model=List[CustomerResponse])
def search_customers(
    q: Optional[str] = Query(None, description="Search by name or phone"),
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("crm:read"))
):
    query = db.query(Customer).filter(Customer.restaurant_id == current_user.restaurant_id)
    if q:
        cleaned = q.strip()
        query = query.filter(
            (Customer.name.ilike(f"%{cleaned}%")) |
            (Customer.phone.ilike(f"%{cleaned}%"))
        )
    return query.order_by(Customer.total_spend.desc()).limit(limit).all()

@router.post("", response_model=CustomerResponse)
def create_customer(
    req: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("crm:write"))
):
    norm_phone = normalize_phone_number(req.phone)
    existing = db.query(Customer).filter(
        Customer.restaurant_id == current_user.restaurant_id,
        Customer.phone == norm_phone
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A customer with this phone number already exists")

    customer = CRMService.get_or_create_customer(
        db, current_user.restaurant_id, req.name, req.phone, req.email
    )
    if req.tags:
        customer.tags = req.tags
        db.commit()
        db.refresh(customer)
    return customer

@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer_profile(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("crm:read"))
):
    cust = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.restaurant_id == current_user.restaurant_id
    ).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    return cust

@router.get("/{customer_id}/orders", response_model=List[OrderResponse])
def get_customer_order_history(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("crm:read"))
):
    cust = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.restaurant_id == current_user.restaurant_id
    ).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    orders = db.query(Order).filter(
        (Order.customer_id == cust.id) | (Order.customer_phone == cust.phone),
        Order.restaurant_id == current_user.restaurant_id
    ).order_by(Order.created_at.desc()).all()
    return orders

@router.post("/{customer_id}/loyalty", response_model=CustomerResponse)
def adjust_customer_loyalty(
    customer_id: str,
    req: LoyaltyAdjustRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("crm:points"))
):
    note = req.notes or req.reason or "Manual loyalty points adjustment"
    tx_type = req.transaction_type or LoyaltyTxType.ADJUSTMENT
    idemp = req.idempotency_key or f"loyalty-{customer_id}-{uuid.uuid4().hex[:8]}"

    CRMService.adjust_points(
        db, customer_id, current_user.restaurant_id,
        tx_type, req.points, note, idemp
    )
    cust = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.restaurant_id == current_user.restaurant_id
    ).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    return cust

@router.post("/{customer_id}/feedback", response_model=FeedbackResponse)
def submit_customer_feedback(
    customer_id: str,
    req: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_permission("crm:write"))
):
    cust = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.restaurant_id == current_user.restaurant_id
    ).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    fb = CustomerFeedback(
        id=f"fb-{uuid.uuid4().hex[:10]}",
        restaurant_id=current_user.restaurant_id,
        customer_id=cust.id,
        order_id=req.order_id,
        rating=max(1, min(5, req.rating)),
        comment=req.comment
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return fb
