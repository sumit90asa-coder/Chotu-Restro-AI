from datetime import datetime, timezone
from decimal import Decimal
import enum
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum as SQLEnum, Numeric
from app.database.session import Base

class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    UPI = "upi"
    CARD = "card"
    ONLINE = "online"
    COMPLIMENTARY = "complimentary"

class PaymentRecordStatus(str, enum.Enum):
    SUCCESS = "success"
    PENDING = "pending"
    FAILED = "failed"
    REFUNDED = "refunded"

class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(String, primary_key=True, index=True)
    order_id = Column(String, ForeignKey("orders.id"), nullable=False, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    method = Column(SQLEnum(PaymentMethod), default=PaymentMethod.CASH, nullable=False)
    status = Column(SQLEnum(PaymentRecordStatus), default=PaymentRecordStatus.SUCCESS, nullable=False)
    transaction_ref = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
