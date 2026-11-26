import pytest
from fastapi.testclient import TestClient
from app.models.table import DiningTable, TableStatus
from app.models.menu import MenuItem

def test_qr_self_order_persistence_and_occupancy(unauthenticated_client: TestClient, db_session):
    client = unauthenticated_client

    # 1. Fetch a real table with qr_token from db_session
    table = db_session.query(DiningTable).filter(DiningTable.qr_token.isnot(None)).first()
    assert table is not None
    qr_token = table.qr_token

    # Ensure table is initially vacant
    table.status = TableStatus.VACANT
    table.current_order_id = None
    db_session.commit()

    # 2. Query QR menu
    menu_resp = client.get(f"/api/v1/qr/{qr_token}/menu")
    assert menu_resp.status_code == 200
    menu_data = menu_resp.json()
    assert menu_data["table_status"] == "vacant"
    assert len(menu_data["items"]) > 0
    dish = menu_data["items"][0]

    # 3. Initially, no active order should exist
    order_check = client.get(f"/api/v1/qr/{qr_token}/order")
    assert order_check.status_code == 200
    assert order_check.json() is None

    # 4. Place first QR order (Round 1: 2x dish)
    order_resp1 = client.post(f"/api/v1/qr/{qr_token}/orders", json={
        "customer_name": "Test Diner",
        "items": [
            {"dish_id": dish["id"], "name": dish["name"], "price": float(dish["price"]), "quantity": 2}
        ]
    })
    assert order_resp1.status_code == 200, f"Order failed: {order_resp1.text}"
    order1 = order_resp1.json()
    order_id = order1["id"]
    total1 = float(order1["total_amount"])
    assert total1 > 0

    # Table must now be OCCUPIED
    db_session.refresh(table)
    assert table.status == TableStatus.OCCUPIED
    assert table.current_order_id == order_id

    # 5. Customer refreshes page -> GET /{token}/order must return existing order
    refresh_resp = client.get(f"/api/v1/qr/{qr_token}/order")
    assert refresh_resp.status_code == 200
    persisted_order = refresh_resp.json()
    assert persisted_order is not None
    assert persisted_order["id"] == order_id
    assert float(persisted_order["total_amount"]) == total1

    # 6. Customer places reorder (Round 2: 1x another dish if available or 1x same dish)
    dish2 = menu_data["items"][1] if len(menu_data["items"]) > 1 else dish
    order_resp2 = client.post(f"/api/v1/qr/{qr_token}/orders", json={
        "customer_name": "Test Diner",
        "items": [
            {"dish_id": dish2["id"], "name": dish2["name"], "price": float(dish2["price"]), "quantity": 1}
        ]
    })
    assert order_resp2.status_code == 200
    order2 = order_resp2.json()
    assert order2["id"] == order_id  # Appends to same table order
    total2 = float(order2["total_amount"])
    assert total2 > total1  # Cumulative total increased without wiping previous order
