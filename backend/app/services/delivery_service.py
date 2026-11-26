import secrets
import hashlib
import hmac
from datetime import datetime, timezone, timedelta
from typing import Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.order import Order, OrderStatus
from app.models.audit_log import AuditLog

def hash_delivery_otp(otp: str, salt: str) -> str:
    return hashlib.sha256((salt + otp).encode("utf-8")).hexdigest()

class DeliveryService:
    @staticmethod
    def dispatch_order(
        db: Session,
        order_id: str,
        restaurant_id: str,
        rider_name: str,
        rider_phone: str
    ) -> Tuple[Order, str]:
        """
        Dispatches order, generates secure 4-digit OTP, stores its salted hash,
        and returns the plaintext OTP once only for SMS/WhatsApp transmission.
        """
        order = db.query(Order).filter(
            Order.id == order_id,
            Order.restaurant_id == restaurant_id
        ).with_for_update().first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        # Generate cryptographically secure 4-digit OTP
        plain_otp = f"{secrets.randbelow(9000) + 1000}"
        salt = secrets.token_hex(16)
        hashed = hash_delivery_otp(plain_otp, salt)

        now = datetime.now(timezone.utc)
        order.delivery_otp_hash = hashed
        order.delivery_otp_salt = salt
        order.delivery_otp_expires_at = now + timedelta(hours=2)
        order.delivery_otp_attempts = 0
        order.delivery_otp_verified_at = None
        order.dispatch_time = now
        order.aggregator_rider_name = rider_name
        order.aggregator_rider_status = f"Dispatched • Rider: {rider_name} ({rider_phone})"
        order.status = OrderStatus.OUT_FOR_DELIVERY

        db.commit()
        db.refresh(order)
        return order, plain_otp

    @staticmethod
    def verify_handover_otp(
        db: Session,
        order_id: str,
        restaurant_id: str,
        entered_otp: str
    ) -> Order:
        """
        Verifies customer OTP at door handover.
        Enforces:
        - 3-attempt brute force lockout
        - 2-hour expiration
        - Single-use replay protection
        - Constant-time comparison
        """
        order = db.query(Order).filter(
            Order.id == order_id,
            Order.restaurant_id == restaurant_id
        ).with_for_update().first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        if order.delivery_otp_verified_at is not None:
            raise HTTPException(status_code=400, detail="Order already delivered and verified (Replay prevented)")

        if not order.delivery_otp_hash or not order.delivery_otp_salt:
            raise HTTPException(status_code=400, detail="No active dispatch OTP generated for this order")

        now = datetime.now(timezone.utc)
        if order.delivery_otp_expires_at and now > order.delivery_otp_expires_at.replace(tzinfo=timezone.utc if order.delivery_otp_expires_at.tzinfo is None else order.delivery_otp_expires_at.tzinfo):
            raise HTTPException(status_code=400, detail="Delivery OTP has expired (2 hours limit)")

        if order.delivery_otp_attempts >= 3:
            raise HTTPException(status_code=429, detail="Maximum OTP verification attempts exceeded (Locked). Contact manager.")

        # Compute hash
        computed_hash = hash_delivery_otp(entered_otp.strip(), order.delivery_otp_salt)
        if not hmac.compare_digest(computed_hash, order.delivery_otp_hash):
            order.delivery_otp_attempts += 1
            remaining = 3 - order.delivery_otp_attempts
            db.commit()
            raise HTTPException(
                status_code=400,
                detail=f"Invalid OTP. {remaining} attempt(s) remaining before security lockout."
            )

        # OTP verified successfully!
        order.delivery_otp_verified_at = now
        order.delivery_otp_hash = None  # Single-use: wipe hash
        order.status = OrderStatus.COMPLETED
        order.delivered_time = now
        order.aggregator_rider_status = "Delivered & Verified via OTP"

        audit = AuditLog(
            id=f"aud-{secrets.token_hex(8)}",
            restaurant_id=restaurant_id,
            user_id="rider",
            action="DELIVERY_HANDOVER_VERIFIED",
            entity="order",
            entity_id=order.id,
            details=f"OTP successfully verified for delivery order #{order.order_number}"
        )
        db.add(audit)

        db.commit()
        db.refresh(order)
        return order

    @staticmethod
    def regenerate_otp(
        db: Session,
        order_id: str,
        restaurant_id: str,
        manager_user_id: str,
    ) -> Tuple[Order, str]:
        """
        Manager/Owner-only: Generates a fresh 4-digit OTP, resets failed attempt lockout,
        and extends expiration by 2 hours.
        """
        order = db.query(Order).filter(
            Order.id == order_id,
            Order.restaurant_id == restaurant_id
        ).with_for_update().first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        if order.delivery_otp_verified_at is not None or order.status == OrderStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Order is already delivered and verified")

        if order.status != OrderStatus.OUT_FOR_DELIVERY:
            raise HTTPException(status_code=400, detail="Order must be dispatched before regenerating OTP")

        plain_otp = f"{secrets.randbelow(9000) + 1000}"
        salt = secrets.token_hex(16)
        hashed = hash_delivery_otp(plain_otp, salt)
        now = datetime.now(timezone.utc)

        order.delivery_otp_hash = hashed
        order.delivery_otp_salt = salt
        order.delivery_otp_expires_at = now + timedelta(hours=2)
        order.delivery_otp_attempts = 0
        order.aggregator_rider_status = f"OTP Reset by Manager • {order.aggregator_rider_name or 'Rider'}"

        audit = AuditLog(
            id=f"aud-{secrets.token_hex(8)}",
            restaurant_id=restaurant_id,
            user_id=manager_user_id,
            action="DELIVERY_OTP_REGENERATED",
            entity="order",
            entity_id=order.id,
            details=f"Manager regenerated delivery OTP and cleared lockout for order #{order.order_number}"
        )
        db.add(audit)
        db.commit()
        db.refresh(order)
        return order, plain_otp

    @staticmethod
    def manager_override_handover(
        db: Session,
        order_id: str,
        restaurant_id: str,
        manager_user_id: str,
        reason: str = "Manager verified customer handover manually",
    ) -> Order:
        """
        Manager/Owner-only: Manually completes delivery handover when OTP verification fails or is unavailable.
        """
        order = db.query(Order).filter(
            Order.id == order_id,
            Order.restaurant_id == restaurant_id
        ).with_for_update().first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        if order.delivery_otp_verified_at is not None or order.status == OrderStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Order already delivered and verified")

        now = datetime.now(timezone.utc)
        order.delivery_otp_verified_at = now
        order.delivery_otp_hash = None
        order.status = OrderStatus.COMPLETED
        order.delivered_time = now
        order.aggregator_rider_status = "Delivered • Manager Override"

        audit = AuditLog(
            id=f"aud-{secrets.token_hex(8)}",
            restaurant_id=restaurant_id,
            user_id=manager_user_id,
            action="DELIVERY_MANAGER_OVERRIDE",
            entity="order",
            entity_id=order.id,
            details=f"Manager override for order #{order.order_number}: {reason}"
        )
        db.add(audit)
        db.commit()
        db.refresh(order)
        return order
