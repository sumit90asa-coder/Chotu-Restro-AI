from decimal import Decimal
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from app.models.order import Order, OrderItem, OrderMode, OrderStatus, PaymentStatus

def test_delivery_order_lifecycle(client: TestClient, db_session):
    # 1. Create a genuine delivery order in database
    delivery_order = Order(
        id="ord-del-test-01",
        restaurant_id="rest-spice-jct",
        order_number="DEL-101",
        token_number="IND-DEL-0001",
        customer_name="Anita Desai",
        customer_phone="+919876543210",
        delivery_address="Flat 402, Sea View Apts, Bandra West, Mumbai",
        mode=OrderMode.DELIVERY,
        status=OrderStatus.PREPARING,
        payment_status=PaymentStatus.PAID,
        subtotal=Decimal("450.00"),
        total_amount=Decimal("472.50")
    )
    db_session.add(delivery_order)
    db_session.flush()

    item1 = OrderItem(
        id="item-del-01",
        order_id=delivery_order.id,
        menu_item_id="dish-01",
        name="Paneer Butter Masala",
        price=Decimal("350.00"),
        quantity=1,
        status="cooking"
    )
    item2 = OrderItem(
        id="item-del-02",
        order_id=delivery_order.id,
        menu_item_id="dish-02",
        name="Butter Naan",
        price=Decimal("50.00"),
        quantity=2,
        status="cooking"
    )
    db_session.add_all([item1, item2])
    db_session.commit()

    # 2. Query delivery orders via API
    resp = client.get("/api/v1/delivery/orders")
    assert resp.status_code == 200
    orders = resp.json()
    assert len(orders) >= 1

    matched = next((o for o in orders if o["id"] == "ord-del-test-01"), None)
    assert matched is not None
    assert matched["customer_name"] == "Anita Desai"
    assert "Paneer Butter Masala" in matched["items_summary"]
    assert "2x Butter Naan" in matched["items_summary"]

    # 3. Dispatch the order
    dispatch_resp = client.post(f"/api/v1/delivery/orders/{delivery_order.id}/dispatch", json={
        "rider_name": "Raju Rider",
        "rider_phone": "+919820011223"
    })
    assert dispatch_resp.status_code == 200
    dispatch_data = dispatch_resp.json()
    assert dispatch_data["status"] == "success"
    otp = dispatch_data["delivery_otp"]
    assert otp is not None
    assert len(otp) == 4

    # 4. Verify OTP handover
    verify_resp = client.post(f"/api/v1/delivery/orders/{delivery_order.id}/verify-otp", json={
        "otp": otp
    })
    assert verify_resp.status_code == 200
    verify_data = verify_resp.json()
    assert verify_data["status"] == "verified"

    # 5. Check order status in DB
    db_session.refresh(delivery_order)
    assert delivery_order.status == OrderStatus.COMPLETED or delivery_order.delivered_time is not None
