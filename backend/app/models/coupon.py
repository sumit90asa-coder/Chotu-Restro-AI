from datetime import datetime
import uuid
from sqlalchemy import Column, String, Boolean, Numeric, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database.session import Base

class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(String(50), primary_key=True, default=lambda: f"cpn-{uuid.uuid4().hex[:8]}")
    restaurant_id = Column(String(50), ForeignKey("restaurants.id"), nullable=False, index=True)
    code = Column(String(50), nullable=False, index=True)
    description = Column(String(255), nullable=True)
    discount_type = Column(String(20), default="percentage", nullable=False)  # "percentage" or "flat"
    discount_value = Column(Numeric(10, 2), nullable=False)
    min_order_value = Column(Numeric(10, 2), default=0.00, nullable=False)
    max_discount = Column(Numeric(10, 2), nullable=True)
    usage_limit = Column(Integer, default=1000, nullable=False)
    used_count = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    restaurant = relationship("Restaurant", backref="coupons")

    __table_args__ = (
        Index("idx_coupons_rest_code", "restaurant_id", "code"),
    )
