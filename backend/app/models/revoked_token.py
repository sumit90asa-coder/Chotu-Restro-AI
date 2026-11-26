from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Index
from app.database.session import Base

class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id = Column(String(64), primary_key=True, index=True)  # JTI or SHA-256 token hash
    token = Column(Text, nullable=False)
    user_id = Column(String(50), nullable=True, index=True)
    revoked_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True, index=True)

    __table_args__ = (
        Index("idx_revoked_tokens_expires_at", "expires_at"),
    )
