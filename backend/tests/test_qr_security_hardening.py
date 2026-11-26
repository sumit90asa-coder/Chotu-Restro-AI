import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.database.session import get_db
from app.models.restaurant import Restaurant
from app.models.table import DiningTable, TableStatus
from app.models.menu import MenuItem, DietaryType, StationType
from app.models.order import Order, OrderStatus

def test_qr_security_hardening(db_session: Session):
    # Setup test restaurant, table, and menu item
    rest = Restaurant(
        id="rest-qr-sec-test",
        name="QR Security Test Restro",
        code="QRSEC1",
        address="101 Test Road",
        phone="+919876543210",
        currency="INR"
    )
    db_session.add(rest)

    from app.models.menu import MenuCategory
    cat = MenuCategory(
        id="cat-qr-sec-1",
        restaurant_id=rest.id,
        name="Main",
        slug="main"
    )
    db_session.add(cat)
    
    table = DiningTable(
        id="tbl-qr-sec-1",
        restaurant_id=rest.id,
        label="T-SEC-1",
        capacity=4,
        status=TableStatus.VACANT,
        qr_token="qr-token-sec-12345"
    )
    db_session.add(table)
    
    dish = MenuItem(
        id="item-qr-sec-1",
        restaurant_id=rest.id,
        category_id=cat.id,
        name="Butter Chicken",
        price=Decimal("350.00"),
        is_active=True,
        is_in_stock=True,
        dietary=DietaryType.NONVEG,
        station=StationType.CURRY
    )
    db_session.add(dish)
    db_session.commit()

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    try:
        token = "qr-token-sec-12345"

        # 1. Table is vacant initially
        t_info = client.get(f"/api/v1/qr/{token}/table").json()
        assert t_info["status"] == "vacant"

        # 2. Initially no active order
        res_empty = client.get(f"/api/v1/qr/{token}/order")
        assert res_empty.status_code == 200
        assert res_empty.json() is None

        # 3. Guest A places initial self-order
        order_payload = {
            "customer_name": "Guest A",
            "items": [
                {"dish_id": dish.id, "name": dish.name, "price": 350.0, "quantity": 2}
            ],
            "captain_notes": "First round"
        }
        res_post = client.post(f"/api/v1/qr/{token}/orders", json=order_payload)
        assert res_post.status_code == 200
        order_data = res_post.json()
        session_token = res_post.headers.get("x-customer-session") or order_data.get("customer_session_token")
        assert session_token is not None
        assert order_data["status"] == "preparing"
        assert len(order_data["items"]) == 1
        assert order_data["items"][0]["quantity"] == 2

        # Verify table is now OCCUPIED
        db_session.refresh(table)
        assert table.status == TableStatus.OCCUPIED
        assert table.current_order_id == order_data["id"]

        # 4. Privacy Barrier: External scanner without session token CANNOT see Guest A's order
        res_no_session = client.get(f"/api/v1/qr/{token}/order")
        assert res_no_session.status_code == 200
        assert res_no_session.json() is None

        # External scanner with WRONG session token CANNOT see Guest A's order
        res_wrong_session = client.get(f"/api/v1/qr/{token}/order", headers={"X-Customer-Session": "sess-attacker-999"})
        assert res_wrong_session.status_code == 200
        assert res_wrong_session.json() is None

        # 5. Legitimate Guest A with matching session CAN view running bill and items
        res_guest_a = client.get(f"/api/v1/qr/{token}/order", headers={"X-Customer-Session": session_token})
        assert res_guest_a.status_code == 200
        assert res_guest_a.json()["id"] == order_data["id"]
        assert len(res_guest_a.json()["items"]) == 1

        # 6. Re-order: Guest A orders another dish with same session token
        reorder_payload = {
            "customer_name": "Guest A",
            "items": [
                {"dish_id": dish.id, "name": dish.name, "price": 350.0, "quantity": 1}
            ],
            "captain_notes": "Second round"
        }
        res_reorder = client.post(
            f"/api/v1/qr/{token}/orders",
            json=reorder_payload,
            headers={"X-Customer-Session": session_token}
        )
        assert res_reorder.status_code == 200
        reorder_data = res_reorder.json()
        assert reorder_data["id"] == order_data["id"]  # Same order accumulated!
        assert len(reorder_data["items"]) == 1
        assert reorder_data["items"][0]["quantity"] == 3  # 2 + 1 = 3

        # 7. External user attempting to order on occupied table with wrong session gets 403
        res_hijack = client.post(
            f"/api/v1/qr/{token}/orders",
            json=order_payload,
            headers={"X-Customer-Session": "sess-another-intruder"}
        )
        assert res_hijack.status_code == 403

    finally:
        app.dependency_overrides.clear()
