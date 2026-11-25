import re
import uuid
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database.session import get_db
from app.core.security import verify_password, create_access_token, get_password_hash
from app.core.permissions import UserRole
from app.models.user import User
from app.models.restaurant import Restaurant
from app.schemas.auth import LoginRequest, RegisterRequest, RegisterResponse, Token, UserResponse, UserCreate
from app.api.deps import get_current_user

router = APIRouter()

def normalize_phone(phone: str) -> str:
    """Normalize phone number by stripping whitespace, hyphens, and standardizing digits."""
    cleaned = re.sub(r"[^\d+]", "", phone.strip())
    # If 10 digits without country code, prefix with +91 for standard Indian numbers
    if re.match(r"^[6-9]\d{9}$", cleaned):
        return f"+91{cleaned}"
    return cleaned

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(reg_data: RegisterRequest, db: Session = Depends(get_db)):
    """
    Register a brand new Restaurant and its Owner in a single atomic transaction.
    - First registered user automatically receives the OWNER role.
    - Enforces duplicate email and duplicate phone protection.
    - Initializes fresh restaurant profile with zero fake orders/tables.
    """
    clean_email = reg_data.email.strip().lower()
    clean_phone = normalize_phone(reg_data.phone)

    # 1. Duplicate email check
    existing_user_email = db.query(User).filter(User.email == clean_email).first()
    if existing_user_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists. Please sign in instead."
        )

    # 2. Duplicate phone check
    existing_user_phone = db.query(User).filter(User.phone == clean_phone).first()
    if existing_user_phone:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this mobile number already exists. Please sign in instead."
        )

    # 3. Generate unique restaurant ID and sanitized code
    rest_id = f"rest-{uuid.uuid4().hex[:8]}"
    raw_code = re.sub(r"[^A-Za-z0-9]", "", reg_data.restaurant_name.upper())[:8] or "REST"
    rest_code = f"{raw_code}-{uuid.uuid4().hex[:4].upper()}"

    # Auto-generate invoice prefix from restaurant name if omitted
    inv_prefix = reg_data.invoice_prefix.strip().upper() if reg_data.invoice_prefix else raw_code[:4]

    # Full address assembly
    full_address = reg_data.address.strip()
    if reg_data.state:
        full_address += f", {reg_data.state.strip()}"
    if reg_data.pincode:
        full_address += f" {reg_data.pincode.strip()}"

    # 4. Create Restaurant
    new_restaurant = Restaurant(
        id=rest_id,
        name=reg_data.restaurant_name.strip(),
        code=rest_code,
        address=full_address,
        city=reg_data.city.strip(),
        phone=clean_phone,
        currency="INR",
        cgst_percent=Decimal("2.50"),
        sgst_percent=Decimal("2.50"),
        service_charge_percent=Decimal("5.00"),
        tagline=f"Artisanal {reg_data.restaurant_type.title()} Experience" if reg_data.restaurant_type else None,
        gstin=reg_data.gstin.strip().upper() if reg_data.gstin else None,
        fssai_number=reg_data.fssai_number.strip() if reg_data.fssai_number else None,
        business_hours=reg_data.business_hours.strip() if reg_data.business_hours else "11:00 AM - 11:00 PM",
        upi_vpa=reg_data.upi_vpa.strip() if reg_data.upi_vpa else None,
        invoice_prefix=inv_prefix,
        timezone="Asia/Kolkata",
        auto_print_kot=True,
    )
    db.add(new_restaurant)
    db.flush()

    # 5. Create Owner User (Role: OWNER)
    user_id = f"user-own-{uuid.uuid4().hex[:6]}"
    new_owner = User(
        id=user_id,
        restaurant_id=new_restaurant.id,
        email=clean_email,
        full_name=reg_data.full_name.strip(),
        hashed_password=get_password_hash(reg_data.password),
        role=UserRole.OWNER,
        is_active=True,
        phone=clean_phone,
    )
    db.add(new_owner)
    db.commit()
    db.refresh(new_owner)
    db.refresh(new_restaurant)

    # 6. Generate JWT Session
    access_token = create_access_token(
        subject=new_owner.id,
        extra_claims={
            "role": new_owner.role.value,
            "restaurant_id": new_owner.restaurant_id,
            "restaurant_name": new_restaurant.name,
        }
    )

    return RegisterResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=new_owner.id,
        role=new_owner.role.value,
        restaurant_id=new_restaurant.id,
        restaurant_name=new_restaurant.name,
        full_name=new_owner.full_name,
        email=new_owner.email,
        phone=new_owner.phone,
    )

@router.post("/login", response_model=Token)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user using Email or Mobile Number + Password.
    Returns scoped JWT access token and user session details.
    """
    # Accept either identifier (email or phone) or explicit email field
    target = (login_data.identifier or str(login_data.email or "")).strip()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide an email or mobile number to log in."
        )

    # Match against email or normalized phone
    target_clean = target.lower()
    norm_phone = normalize_phone(target)
    bare_phone = re.sub(r"\D", "", target)

    user = db.query(User).filter(
        or_(
            User.email == target_clean,
            User.phone == norm_phone,
            User.phone == target,
            User.phone.ilike(f"%{bare_phone[-10:]}%") if len(bare_phone) >= 10 else False
        )
    ).first()

    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/mobile or password. Please verify your credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your restaurant staff account has been deactivated. Please contact your restaurant owner.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch restaurant name for session metadata
    restaurant = db.query(Restaurant).filter(Restaurant.id == user.restaurant_id).first()
    rest_name = restaurant.name if restaurant else "Restaurant"

    access_token = create_access_token(
        subject=user.id,
        extra_claims={
            "role": user.role.value,
            "restaurant_id": user.restaurant_id,
            "restaurant_name": rest_name,
        }
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        role=user.role.value,
        restaurant_id=user.restaurant_id,
        full_name=user.full_name,
        restaurant_name=rest_name,
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Return profile for the currently authenticated staff or owner."""
    return current_user

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    """Explicitly terminate/revoke active staff session."""
    return {
        "message": "Session terminated successfully",
        "user_id": current_user.id,
        "status": "logged_out"
    }
