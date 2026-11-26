from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.coupon import Coupon
from app.schemas.coupon import (
    CouponCreate,
    CouponUpdate,
    CouponResponse,
    CouponValidateRequest,
    CouponValidateResponse,
)

router = APIRouter()

@router.get("", response_model=List[CouponResponse])
def get_coupons(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all promotional coupons for the authenticated restaurant."""
    coupons = (
        db.query(Coupon)
        .filter(Coupon.restaurant_id == current_user.restaurant_id)
        .order_by(Coupon.created_at.desc())
        .all()
    )
    return coupons

@router.post("", response_model=CouponResponse, status_code=status.HTTP_201_CREATED)
def create_coupon(
    data: CouponCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new promotional discount voucher with server-side persistence."""
    clean_code = data.code.strip().upper()

    existing = (
        db.query(Coupon)
        .filter(
            Coupon.restaurant_id == current_user.restaurant_id,
            Coupon.code == clean_code,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Promo code '{clean_code}' already exists for this restaurant.",
        )

    coupon = Coupon(
        restaurant_id=current_user.restaurant_id,
        code=clean_code,
        description=data.description.strip() if data.description else None,
        discount_type=data.discount_type,
        discount_value=data.discount_value,
        min_order_value=data.min_order_value,
        max_discount=data.max_discount,
        usage_limit=data.usage_limit,
        used_count=0,
        is_active=True,
        expires_at=data.expires_at,
    )
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return coupon

@router.patch("/{coupon_id}/toggle", response_model=CouponResponse)
def toggle_coupon_status(
    coupon_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle promo code active/disabled state in PostgreSQL."""
    coupon = (
        db.query(Coupon)
        .filter(
            Coupon.id == coupon_id,
            Coupon.restaurant_id == current_user.restaurant_id,
        )
        .first()
    )
    if not coupon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Promo code not found or access denied.",
        )

    coupon.is_active = not coupon.is_active
    db.commit()
    db.refresh(coupon)
    return coupon

@router.delete("/{coupon_id}", status_code=status.HTTP_200_OK)
def delete_coupon(
    coupon_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete a promo code from PostgreSQL."""
    coupon = (
        db.query(Coupon)
        .filter(
            Coupon.id == coupon_id,
            Coupon.restaurant_id == current_user.restaurant_id,
        )
        .first()
    )
    if not coupon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Promo code not found or access denied.",
        )

    db.delete(coupon)
    db.commit()
    return {"message": f"Promo code '{coupon.code}' successfully deleted.", "id": coupon_id}

@router.post("/validate", response_model=CouponValidateResponse)
def validate_coupon(
    payload: CouponValidateRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Validate a promo code server-side against cart subtotal.
    Enforces active status, expiration, and minimum order threshold in PostgreSQL.
    """
    code_clean = payload.code.strip().upper()
    rest_id = current_user.restaurant_id if current_user else None

    query = db.query(Coupon).filter(Coupon.code == code_clean)
    if rest_id:
        query = query.filter(Coupon.restaurant_id == rest_id)
    
    coupon = query.first()
    if not coupon:
        return CouponValidateResponse(
            valid=False,
            code=code_clean,
            discount_type="none",
            discount_value=0.0,
            discount_amount=0.0,
            final_subtotal=float(payload.subtotal),
            message=f"Promo code '{code_clean}' is invalid or does not exist.",
        )

    # Check active state
    if not coupon.is_active:
        return CouponValidateResponse(
            valid=False,
            code=code_clean,
            discount_type=coupon.discount_type,
            discount_value=float(coupon.discount_value),
            discount_amount=0.0,
            final_subtotal=float(payload.subtotal),
            message=f"Promo code '{code_clean}' is currently disabled.",
        )

    # Check expiration
    if coupon.expires_at and coupon.expires_at < datetime.utcnow():
        return CouponValidateResponse(
            valid=False,
            code=code_clean,
            discount_type=coupon.discount_type,
            discount_value=float(coupon.discount_value),
            discount_amount=0.0,
            final_subtotal=float(payload.subtotal),
            message=f"Promo code '{code_clean}' expired on {coupon.expires_at.strftime('%Y-%m-%d')}.",
        )

    # Check minimum order value
    if payload.subtotal < coupon.min_order_value:
        return CouponValidateResponse(
            valid=False,
            code=code_clean,
            discount_type=coupon.discount_type,
            discount_value=float(coupon.discount_value),
            discount_amount=0.0,
            final_subtotal=float(payload.subtotal),
            message=f"Minimum order value of ₹ {coupon.min_order_value:.2f} required for '{code_clean}'.",
        )

    # Check usage limit
    if coupon.usage_limit and coupon.used_count >= coupon.usage_limit:
        return CouponValidateResponse(
            valid=False,
            code=code_clean,
            discount_type=coupon.discount_type,
            discount_value=float(coupon.discount_value),
            discount_amount=0.0,
            final_subtotal=float(payload.subtotal),
            message=f"Promo code '{code_clean}' usage limit has been reached.",
        )

    # Calculate discount amount
    subtotal = payload.subtotal
    if coupon.discount_type == "percentage":
        discount = (subtotal * coupon.discount_value) / Decimal("100.00")
        if coupon.max_discount:
            discount = min(discount, coupon.max_discount)
    else:
        discount = min(coupon.discount_value, subtotal)

    final_sub = max(Decimal("0.00"), subtotal - discount)

    return CouponValidateResponse(
        valid=True,
        code=code_clean,
        discount_type=coupon.discount_type,
        discount_value=float(coupon.discount_value),
        discount_amount=float(discount),
        final_subtotal=float(final_sub),
        message=f"Coupon applied! You saved ₹ {discount:.2f}",
    )
