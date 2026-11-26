def test_qr_menu_and_order_flow(client):
    """
    CRITICAL WORKFLOW TEST:
    1. Scan QR token for Table T-04 -> fetches menu
    2. Place order via QR -> creates real order, automatically fires KOT to kitchen
    3. Verify KOT is visible in KDS
    """
    # 1. Fetch menu via table QR token
    menu_resp = client.get("/api/v1/qr/qr-t04-demo/menu")
    assert menu_resp.status_code == 200
    data = menu_resp.json()
    assert data["table_label"] == "T-04"
    assert data["table_status"] in ["vacant", "occupied"]
    assert len(data["items"]) >= 10

    # 2. Submit QR order
    order_resp = client.post(
        "/api/v1/qr/qr-t04-demo/orders",
        json={
            "customer_name": "Arjun Kapoor (Guest QR)",
            "captain_notes": "Table 4 self-order from smartphone",
            "items": [
                {
                    "dish_id": "dish-01",
                    "name": "Butter Chicken (Boneless)",
                    "price": 340.0,
                    "quantity": 1,
                    "dietary": "nonveg",
                    "station": "curry"
                },
                {
                    "dish_id": "dish-04",
                    "name": "Garlic Butter Naan",
                    "price": 60.0,
                    "quantity": 2,
                    "dietary": "veg",
                    "station": "tandoor"
                }
            ]
        }
    )
    assert order_resp.status_code == 200
    created_order = order_resp.json()
    assert created_order["table_id"] == "T-04"
    assert created_order["placed_by"] == "qr"
    assert float(created_order["total_amount"]) > 0

    # 3. Verify KOT appears in KDS queue
    kds_resp = client.get("/api/v1/kds/tickets?status=active")
    assert kds_resp.status_code == 200
    tickets = kds_resp.json()
    assert any(t["table_id"] == "T-04" for t in tickets)


def test_qr_table_info_endpoint(client):
    """Verify GET /api/v1/qr/{token}/table returns accurate restaurant and table details."""
    resp = client.get("/api/v1/qr/qr-t01-demo/table")
    assert resp.status_code == 200
    data = resp.json()
    assert data["table_id"] == "T-01"
    assert data["restaurant_name"] == "The Spice Junction"
    assert "capacity" in data
    assert data["qr_token"] == "qr-t01-demo"


def test_qr_invalid_tokens_return_404(client):
    """Verify invalid or non-existent tokens return 404."""
    for path in ["/api/v1/qr/invalid-fake-token/menu", "/api/v1/qr/invalid-fake-token/table"]:
        resp = client.get(path)
        assert resp.status_code == 404
        assert "Invalid or expired QR token" in resp.json()["detail"]


def test_qr_out_of_stock_item_rejected(client, db_session):
    """Verify that ordering an out-of-stock item is rejected with HTTP 400."""
    from app.models.menu import MenuItem
    dish = db_session.query(MenuItem).filter(MenuItem.id == "dish-02").first()
    dish.is_in_stock = False
    db_session.commit()

    resp = client.post(
        "/api/v1/qr/qr-t01-demo/orders",
        json={
            "customer_name": "Test Guest",
            "items": [
                {
                    "dish_id": "dish-02",
                    "name": "Paneer Tikka Masala",
                    "price": 290.0,
                    "quantity": 1,
                    "dietary": "veg",
                    "station": "curry"
                }
            ]
        }
    )
    assert resp.status_code == 400
    assert "out of stock" in resp.json()["detail"].lower()


def test_table_qr_regeneration_flow(client, db_session):
    """Verify POST /api/v1/tables/{table_id}/regenerate-qr invalidates old token and assigns new token."""
    from app.models.user import User, UserRole
    from app.core.security import create_access_token
    manager = db_session.query(User).filter(User.role == UserRole.MANAGER).first()
    token = create_access_token(subject=manager.id, extra_claims={"role": manager.role.value, "restaurant_id": manager.restaurant_id})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Old token works initially
    resp1 = client.get("/api/v1/qr/qr-t03-demo/table")
    assert resp1.status_code == 200

    # 2. Regenerate QR token for T-03
    regen_resp = client.post("/api/v1/tables/T-03/regenerate-qr", headers=headers)
    assert regen_resp.status_code == 200
    table_data = regen_resp.json()
    new_token = table_data["qr_token"]
    assert new_token != "qr-t03-demo"
    assert new_token.startswith("chotu_qr_")

    # 3. Old token now fails with 404
    resp_old = client.get("/api/v1/qr/qr-t03-demo/table")
    assert resp_old.status_code == 404

    # 4. New token succeeds
    resp_new = client.get(f"/api/v1/qr/{new_token}/table")
    assert resp_new.status_code == 200
    assert resp_new.json()["table_id"] == "T-03"


def test_qr_assistance_requests(client):
    """
    CRITICAL RESTAURANT SCREEN NOTIFICATION TEST:
    Verify guests can request water service or waiter assistance from QR token,
    and server acknowledges request with exact table identification.
    """
    # 1. Request water service for T-01
    resp_water = client.post(
        "/api/v1/qr/qr-t01-demo/assistance",
        json={"service_type": "water", "notes": "Cold water please"}
    )
    assert resp_water.status_code == 200
    data_water = resp_water.json()
    assert data_water["status"] == "acknowledged"
    assert data_water["service_type"] == "water"
    assert data_water["table_id"] == "T-01"
    assert "T-01" in data_water["message"]
    assert "Water Service" in data_water["message"]

    # 2. Request waiter assistance for T-02
    resp_waiter = client.post(
        "/api/v1/qr/qr-t02-demo/assistance",
        json={"service_type": "waiter"}
    )
    assert resp_waiter.status_code == 200
    data_waiter = resp_waiter.json()
    assert data_waiter["status"] == "acknowledged"
    assert data_waiter["service_type"] == "waiter"
    assert data_waiter["table_id"] == "T-02"
    assert "T-02" in data_waiter["message"]
    assert "Server Assistance" in data_waiter["message"]

    # 3. Invalid token returns 404
    resp_invalid = client.post(
        "/api/v1/qr/invalid-token-xyz/assistance",
        json={"service_type": "water"}
    )
    assert resp_invalid.status_code == 404
