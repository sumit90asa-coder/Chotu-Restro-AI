from datetime import datetime, timezone
from decimal import Decimal
import enum
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum as SQLEnum, Numeric, Text
from sqlalchemy.orm import relationship
from app.database.session import Base
from app.models.menu import DietaryType, StationType

class OrderMode(str, enum.Enum):
    DINE_IN = "dine-in"
    TAKEAWAY = "takeaway"
    DELIVERY = "delivery"
    ZOMATO = "zomato"
    SWIGGY = "swiggy"
    UBEREATS = "ubereats"
    DOORDASH = "doordash"

class OrderStatus(str, enum.Enum):
    NEW = "new"
    PREPARING = "preparing"
    READY = "ready"
    OUT_FOR_DELIVERY = "out-for-delivery"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    INITIATED = "initiated"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"

class PlacedBy(str, enum.Enum):
    POS = "pos"
    QR = "qr"
    VOICE = "voice"
    AGGREGATOR = "aggregator"

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(String, primary_key=True, index=True)
    restaurant_id = Column(String, ForeignKey("restaurants.id"), nullable=False, index=True)
    table_id = Column(String, ForeignKey("dining_tables.id"), nullable=True, index=True)
    
    order_number = Column(String, nullable=False, index=True)
    token_number = Column(String, nullable=False, index=True)
    customer_name = Column(String, default="Guest", nullable=False)
    customer_phone = Column(String, nullable=True)
    mode = Column(SQLEnum(OrderMode), default=OrderMode.DINE_IN, nullable=False)
    delivery_address = Column(Text, nullable=True)
    
    status = Column(SQLEnum(OrderStatus), default=OrderStatus.PREPARING, nullable=False)
    payment_status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PENDING, nullable=False)
    placed_by = Column(SQLEnum(PlacedBy), default=PlacedBy.POS, nullable=False)
    
    # Decimal financial totals
    subtotal = Column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    cgst = Column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    sgst = Column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    service_charge = Column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    discount = Column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    total_amount = Column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    
    # Customer context
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_session_token = Column(String(128), nullable=True, index=True)
    
    # Delivery OTP & Dispatch Security (Phase 4)
    delivery_otp_hash = Column(String(128), nullable=True)
    delivery_otp_salt = Column(String(32), nullable=True)
    delivery_otp_expires_at = Column(DateTime, nullable=True)
    delivery_otp_attempts = Column(Integer, default=0, nullable=False)
    delivery_otp_verified_at = Column(DateTime, nullable=True)
    dispatch_time = Column(DateTime, nullable=True)
    delivered_time = Column(DateTime, nullable=True)
    
    # Applied Tax Rate Snapshots (Phase 4 Historical Price & Tax Lock)
    cgst_rate_snapshot = Column(Numeric(5, 2), default=Decimal("2.50"), nullable=False)
    sgst_rate_snapshot = Column(Numeric(5, 2), default=Decimal("2.50"), nullable=False)
    service_charge_rate_snapshot = Column(Numeric(5, 2), default=Decimal("5.00"), nullable=False)
    
    # Aggregator details
    aggregator_platform = Column(String, nullable=True)
    aggregator_order_id = Column(String, nullable=True)
    aggregator_rider_name = Column(String, nullable=True)
    aggregator_rider_status = Column(String, nullable=True)
    aggregator_otp = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    restaurant = relationship("Restaurant", back_populates="orders")
    customer = relationship("Customer", back_populates="orders")
    table = relationship("DiningTable", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    kots = relationship("KOT", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"
    
    id = Column(String, primary_key=True, index=True)
    order_id = Column(String, ForeignKey("orders.id"), nullable=False, index=True)
    menu_item_id = Column(String, ForeignKey("menu_items.id"), nullable=False)
    variant_id = Column(String(36), ForeignKey("menu_item_variants.id", ondelete="SET NULL"), nullable=True)
    variant_name = Column(String(64), nullable=True)
    name = Column(String, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    dietary = Column(SQLEnum(DietaryType), default=DietaryType.VEG, nullable=False)
    station = Column(SQLEnum(StationType), default=StationType.CURRY, nullable=False)
    notes = Column(String, nullable=True)
    status = Column(String, default="cooking")  # queued, cooking, ready, served
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    order = relationship("Order", back_populates="items")
    variant = relationship("MenuItemVariant")
