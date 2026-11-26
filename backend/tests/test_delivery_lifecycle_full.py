import pytest
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.restaurant import Restaurant
from app.models.table import DiningTable, TableStatus
from app.models.order import Order, OrderMode, OrderStatus, PaymentStatus, PlacedBy
from app.services.delivery_service import DeliveryService, hash_delivery_otp

def test_delivery_lifecycle_full(db_session: Session):
    rest = Restaurant(
        id="rest-deliv-test",
        name="Delivery Test Kitchen",
        code="DELIV1",
        address="102 Test Road",
        phone="+919876543211",
        currency="INR"
    )
    db_session.add(rest)
    
    # Existing dine-in table in restaurant
    table = DiningTable(
        id="tbl-dinein-1",
        restaurant_id=rest.id,
        label="T-DineIn-1",
        capacity=4,
        status=TableStatus.VACANT,
        qr_token="qr-token-deliv-1"
    )
    db_session.add(table)

    # 1. Create a delivery order without table allocation
    order = Order(
        id="ord-deliv-001",
        restaurant_id=rest.id,
        table_id=None,  # Delivery does NOT occupy any dine-in table
        order_number="DEL-101",
        token_number="TK-101",
        customer_name="Rohan Sharma",
        customer_phone="+919876543210",
        delivery_address="402, High Street Towers, Bandra West, Mumbai",
        mode=OrderMode.DELIVERY,
        status=OrderStatus.PREPARING,
        payment_status=PaymentStatus.PAID,
        placed_by=PlacedBy.POS,
        subtotal=Decimal("800.00"),
        total_amount=Decimal("840.00")
    )
    db_session.add(order)
    db_session.commit()

    # Table remains vacant
    db_session.refresh(table)
    assert table.status == TableStatus.VACANT
    assert table.current_order_id is None

    # 2. Dispatch order to rider
    dispatched_order, plain_otp = DeliveryService.dispatch_order(
        db_session,
        order_id=order.id,
        restaurant_id=rest.id,
        rider_name="Vikram Singh",
        rider_phone="+919811122233"
    )

    assert dispatched_order.status == OrderStatus.OUT_FOR_DELIVERY
    assert dispatched_order.aggregator_rider_name == "Vikram Singh"
    assert dispatched_order.dispatch_time is not None
    assert dispatched_order.delivery_otp_hash is not None
    assert plain_otp is not None
    assert len(plain_otp) == 4

    # Verify salted hash integrity
    expected_hash = hash_delivery_otp(plain_otp, dispatched_order.delivery_otp_salt)
    assert dispatched_order.delivery_otp_hash == expected_hash

    # 3. Test wrong OTP rejection and attempt decrement
    with pytest.raises(HTTPException) as exc_info:
        DeliveryService.verify_handover_otp(
            db_session,
            order_id=order.id,
            restaurant_id=rest.id,
            entered_otp="9999"  # Wrong OTP
        )
    assert exc_info.value.status_code == 400
    assert "Invalid OTP" in exc_info.value.detail
    assert dispatched_order.delivery_otp_attempts == 1

    # 4. Test successful handover with correct OTP
    completed_order = DeliveryService.verify_handover_otp(
        db_session,
        order_id=order.id,
        restaurant_id=rest.id,
        entered_otp=plain_otp
    )
    assert completed_order.status == OrderStatus.COMPLETED
    assert completed_order.delivered_time is not None
    assert completed_order.delivery_otp_verified_at is not None
    assert completed_order.delivery_otp_hash is None  # Wiped for single-use replay protection

    # 5. Replay attempt rejected
    with pytest.raises(HTTPException) as replay_exc:
        DeliveryService.verify_handover_otp(
            db_session,
            order_id=order.id,
            restaurant_id=rest.id,
            entered_otp=plain_otp
        )
    assert replay_exc.value.status_code == 400
    assert "already delivered and verified" in replay_exc.value.detail

    # Verify dine-in tables were untouched throughout delivery lifecycle
    db_session.refresh(table)
    assert table.status == TableStatus.VACANT
