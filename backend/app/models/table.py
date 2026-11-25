from datetime import datetime, timezone
from decimal import Decimal
import enum
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum as SQLEnum, Numeric
from sqlalchemy.orm import relationship
from app.database.session import Base

class TableStatus(str, enum.Enum):
    VACANT = "vacant"
    OCCUPIED = "occupied"
    BILLED = "billed"
    RESERVED = "reserved"

class DiningTable(Base):
    __tablename__ = "dining_tables"
    
    id = Column(String, primary_key=True, index=True)
    restaurant_id = Column(String, ForeignKey("restaurants.id"), nullable=False, index=True)
    label = Column(String, nullable=False)
    floor_name = Column(String, default="Main AC Hall", nullable=False)
    capacity = Column(Integer, default=4, nullable=False)
    status = Column(SQLEnum(TableStatus), default=TableStatus.VACANT, nullable=False)
    qr_token = Column(String, unique=True, index=True, nullable=False)
    
    current_order_id = Column(String, nullable=True)
    assigned_waiter_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    captain_name = Column(String, nullable=True)
    current_bill = Column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    opened_at = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    restaurant = relationship("Restaurant", back_populates="tables")
    orders = relationship("Order", back_populates="table")
