import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from app.models.table import DiningTable, TableStatus
from app.models.menu import MenuItem
from app.models.order import Order, OrderItem, OrderMode, OrderStatus, PaymentStatus, PlacedBy
from app.models.kot import KOT, KOTItem, KOTStatus
from app.models.payment import Payment, PaymentMethod, PaymentRecordStatus
from app.models.inventory import Ingredient, RecipeItem, StockTransaction

def test_01_table_transfer_validation_rules(client: TestClient, db_session):
    """
    Test 1: Table Transfers
    - Valid transfer from OCCUPIED to VACANT
    - Reject transfer when source table is VACANT
    - Reject transfer when destination table is already OCCUPIED
    - Reject transfer to nonexistent table
    """
    t1 = db_session.query(DiningTable).filter(DiningTable.id == "T-01").first()
    t2 = db_session.query(DiningTable).filter(DiningTable.id == "T-02").first()
    t3 = db_session.query(DiningTable).filter(DiningTable.id == "T-03").first()
    
    order = Order(
        id="ord-acc-trans-01",
        restaurant_id="rest-spice-jct",
        table_id="T-01",
        order_number="T-01-ACC",
        token_number="IND-ACC-001",
        customer_name="Acceptance Guest",
        mode=OrderMode.DINE_IN,
        status=OrderStatus.PREPARING,
        payment_status=PaymentStatus.PENDING,
        placed_by=PlacedBy.POS,
        subtotal=Decimal("800.00"),
        cgst=Decimal("20.00"),
        sgst=Decimal("20.00"),
        service_charge=Decimal("40.00"),
        discount=Decimal("0.00"),
        total_amount=Decimal("880.00")
    )
    db_session.add(order)
    db_session.flush()

    t1.status = TableStatus.OCCUPIED
    t1.current_order_id = order.id
    t1.current_bill = Decimal("880.00")
    t1.captain_name = "Captain Rahul"
    t1.opened_at = "19:30"

    t2.status = TableStatus.VACANT
    t2.current_order_id = None
    t2.current_bill = Decimal("0.00")

    t3.status = TableStatus.OCCUPIED
    t3.current_order_id = "ord-dummy-03"
    t3.current_bill = Decimal("500.00")
    db_session.commit()

    # Rule A: Reject transfer to already OCCUPIED table
    res_occupied = client.post("/api/v1/tables/T-01/transfer", json={"target_table_id": "T-03"})
    assert res_occupied.status_code == 400
    assert "cannot transfer" in res_occupied.json()["detail"].lower()

    # Rule B: Reject transfer to nonexistent table
    res_notfound = client.post("/api/v1/tables/T-01/transfer", json={"target_table_id": "T-999"})
    assert res_notfound.status_code == 404 or res_notfound.status_code == 400

    # Rule C: Reject transfer from a VACANT table
    res_from_vacant = client.post("/api/v1/tables/T-02/transfer", json={"target_table_id": "T-01"})
    assert res_from_vacant.status_code == 400
    assert "no active order" in res_from_vacant.json()["detail"].lower()

    # Rule D: Valid transfer from T-01 to T-02
    res_valid = client.post("/api/v1/tables/T-01/transfer", json={"target_table_id": "T-02"})
    assert res_valid.status_code == 200
    data = res_valid.json()
    assert data["id"] == "T-02"
    assert data["status"] == "occupied"
    assert float(data["current_bill"]) == 880.0

    # Verify atomic DB state after valid transfer
    db_session.refresh(t1)
    db_session.refresh(t2)
    db_session.refresh(order)
    assert t1.status == TableStatus.VACANT
    assert t1.current_order_id is None
    assert float(t1.current_bill) == 0.0
    assert t2.status == TableStatus.OCCUPIED
    assert t2.current_order_id == "ord-acc-trans-01"
    assert float(t2.current_bill) == 880.0
    assert order.table_id == "T-02"


def test_02_pos_table_isolation_and_quantity_lifecycle(client: TestClient, db_session):
    """
    Test 2: POS Order Creation, Item Customization, Table Isolation & Removal
    - Adding dishes to Table 5
    - Verifying Table 5 items do not bleed into Table 6
    - Updating quantities and notes
    - Removing items when qty drops to zero
    """
    dish1 = db_session.query(MenuItem).filter(MenuItem.name.ilike("%Paneer%")).first()
    dish2 = db_session.query(MenuItem).filter(MenuItem.name.ilike("%Butter Chicken%")).first()
    assert dish1 is not None and dish2 is not None

    # Step 1: Add dish1 to T-05
    res1 = client.post(
        "/api/v1/pos/tables/T-05/order/items",
        json={"dish_id": dish1.id, "delta_qty": 2, "notes": "Extra crispy paneer"}
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["table_id"] == "T-05"
    assert len(data1["items"]) == 1
    assert data1["items"][0]["menu_item_id"] == dish1.id
    assert data1["items"][0]["quantity"] == 2
    assert data1["items"][0]["notes"] == "Extra crispy paneer"

    # Step 2: Verify Table 6 order is isolated and empty
    res_t6 = client.get("/api/v1/pos/tables/T-06/order")
    assert res_t6.status_code == 200
    data_t6 = res_t6.json()
    assert data_t6["table_id"] == "T-06"
    assert len(data_t6["items"]) == 0
    assert float(data_t6["subtotal"]) == 0.0

    # Step 3: Add dish2 to T-05
    res2 = client.post(
        "/api/v1/pos/tables/T-05/order/items",
        json={"dish_id": dish2.id, "delta_qty": 1, "notes": "Less spicy"}
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert len(data2["items"]) == 2

    # Step 4: Decrement dish1 by 1
    res_dec = client.post(
        "/api/v1/pos/tables/T-05/order/items",
        json={"dish_id": dish1.id, "delta_qty": -1}
    )
    assert res_dec.status_code == 200
    dish1_item = next(it for it in res_dec.json()["items"] if it["menu_item_id"] == dish1.id)
    assert dish1_item["quantity"] == 1

    # Step 5: Decrement dish1 by 1 again -> quantity becomes 0, item is pruned
    res_pruned = client.post(
        "/api/v1/pos/tables/T-05/order/items",
        json={"dish_id": dish1.id, "delta_qty": -1}
    )
    assert res_pruned.status_code == 200
    remaining_dish_ids = [it["menu_item_id"] for it in res_pruned.json()["items"]]
    assert dish1.id not in remaining_dish_ids
    assert dish2.id in remaining_dish_ids


def test_03_financial_math_gst_and_settlement(client: TestClient, db_session):
    """
    Test 3: Financial Precision & Settlement
    - 5% GST (2.5% CGST + 2.5% SGST)
    - 5% Service charge
    - Discount handling
    - Payment settlement with Payment record creation
    - Table release to VACANT
    """
    dish = db_session.query(MenuItem).filter(MenuItem.name.ilike("%Biryani%")).first()
    assert dish is not None
    dish_price = Decimal(str(dish.price))

    # Add 2 biryanis to T-07
    client.post(
        "/api/v1/pos/tables/T-07/order/items",
        json={"dish_id": dish.id, "delta_qty": 2}
    )

    # Fetch order to verify financial math
    res_order = client.get("/api/v1/pos/tables/T-07/order")
    assert res_order.status_code == 200
    order_data = res_order.json()

    subtotal = Decimal(str(order_data["subtotal"]))
    expected_subtotal = dish_price * Decimal("2")
    assert subtotal == expected_subtotal

    expected_cgst = (subtotal * Decimal("0.025")).quantize(Decimal("0.01"))
    expected_sgst = (subtotal * Decimal("0.025")).quantize(Decimal("0.01"))
    expected_sc = (subtotal * Decimal("0.05")).quantize(Decimal("0.01"))
    expected_total = subtotal + expected_cgst + expected_sgst + expected_sc

    assert Decimal(str(order_data["cgst"])) == expected_cgst
    assert Decimal(str(order_data["sgst"])) == expected_sgst
    assert Decimal(str(order_data["service_charge"])) == expected_sc
    assert Decimal(str(order_data["total_amount"])) == expected_total

    # Settle Table 7 via UPI
    res_settle = client.post(
        "/api/v1/pos/tables/T-07/settle",
        json={"payment_method": "upi"}
    )
    assert res_settle.status_code == 200
    settled = res_settle.json()
    assert settled["status"] == "completed"
    assert settled["payment_status"] == "paid"

    # Verify table is now VACANT and bill is 0
    t7 = db_session.query(DiningTable).filter(DiningTable.id == "T-07").first()
    assert t7.status == TableStatus.VACANT
    assert t7.current_order_id is None
    assert float(t7.current_bill) == 0.0

    # Verify Payment record exists in DB
    payment = db_session.query(Payment).filter(Payment.order_id == settled["id"]).first()
    assert payment is not None
    assert payment.method == PaymentMethod.UPI
    assert payment.status == PaymentRecordStatus.SUCCESS
    assert payment.amount == expected_total
    assert payment.transaction_ref.startswith("TXN-")

    # Reject duplicate settlement on now-vacant table (HTTP 409 Conflict)
    res_dup_settle = client.post(
        "/api/v1/pos/tables/T-07/settle",
        json={"payment_method": "cash"}
    )
    assert res_dup_settle.status_code == 409


def test_04_kot_generation_kds_tracking_and_bumping(client: TestClient, db_session):
    """
    Test 4: KOT Generation, KDS Station Routing, Prepared Toggle & Bump
    """
    dish = db_session.query(MenuItem).filter(MenuItem.name.ilike("%Tikka%")).first()
    assert dish is not None

    # Step 1: Add item to T-08
    client.post(
        "/api/v1/pos/tables/T-08/order/items",
        json={"dish_id": dish.id, "delta_qty": 3, "notes": "No onions"}
    )

    # Step 2: Fire KOT
    res_kot = client.post(
        "/api/v1/pos/tables/T-08/fire-kot",
        json={"captain_notes": "VIP Guest"}
    )
    assert res_kot.status_code == 200
    kot_data = res_kot.json()
    assert kot_data["status"] == "cooking"
    assert len(kot_data["items"]) == 1
    assert kot_data["items"][0]["quantity"] == 3
    assert kot_data["items"][0]["is_prepared"] == False

    kot_id = kot_data["id"]
    kot_item_id = kot_data["items"][0]["id"]

    # Step 3: Check KDS active tickets
    res_kds = client.get("/api/v1/kds/tickets?status=active")
    assert res_kds.status_code == 200
    tickets = res_kds.json()
    target_ticket = next((t for t in tickets if t["id"] == kot_id), None)
    assert target_ticket is not None
    assert target_ticket["captain_notes"] == "VIP Guest"

    # Step 4: Toggle prepared status of KOT item
    res_toggle = client.patch(f"/api/v1/kds/items/{kot_item_id}/toggle-prepared")
    assert res_toggle.status_code == 200
    assert res_toggle.json()["is_prepared"] == True

    # Step 5: Bump KOT
    res_bump = client.post(f"/api/v1/kds/tickets/{kot_id}/bump")
    assert res_bump.status_code == 200
    assert res_bump.json()["status"] == "bumped"

    # Verify DB state of KOT
    kot_record = db_session.query(KOT).filter(KOT.id == kot_id).first()
    assert kot_record.status == KOTStatus.BUMPED


def test_05_qr_ordering_multi_channel_sync(client: TestClient, db_session):
    """
    Test 5: Contactless QR Order Placement & Real-time Integration
    - Placing order through /api/v1/qr/{token}/orders
    - Automatically attaches to table
    - Generates KOT and transitions table to OCCUPIED
    """
    t4 = db_session.query(DiningTable).filter(DiningTable.id == "T-04").first()
    token = t4.qr_token
    assert token is not None

    dish = db_session.query(MenuItem).filter(MenuItem.is_in_stock == True).first()
    assert dish is not None

    # Place order via QR
    payload = {
        "customer_name": "Mobile Guest",
        "captain_notes": "Extra spicy",
        "items": [
            {
                "dish_id": dish.id,
                "name": dish.name,
                "price": float(dish.price),
                "quantity": 2,
                "dietary": dish.dietary.value,
                "station": dish.station.value,
                "notes": "Extra spicy"
            }
        ]
    }
    res_qr = client.post(f"/api/v1/qr/{token}/orders", json=payload)
    assert res_qr.status_code == 200
    qr_data = res_qr.json()
    assert qr_data["status"] == "preparing"
    assert qr_data["table_id"] == t4.id
    assert "token_number" in qr_data

    # Verify table in DB is occupied
    db_session.refresh(t4)
    assert t4.status == TableStatus.OCCUPIED
    assert t4.current_order_id is not None
    assert float(t4.current_bill) > 0.0


def test_06_edge_cases_and_error_handling(client: TestClient, db_session):
    """
    Test 6: Edge Cases & Input Validation
    - Firing KOT on an empty table order
    - Invalid table ID lookups
    - Transfer to same table
    """
    # Vacant table T-02 with no order
    t2 = db_session.query(DiningTable).filter(DiningTable.id == "T-02").first()
    t2.status = TableStatus.VACANT
    t2.current_order_id = None
    t2.current_bill = Decimal("0.00")
    db_session.commit()

    # Attempt to fire KOT on vacant table without items
    res_empty_kot = client.post("/api/v1/pos/tables/T-02/fire-kot", json={})
    assert res_empty_kot.status_code == 400

    # Attempt to transfer table to itself
    res_same = client.post("/api/v1/tables/T-02/transfer", json={"target_table_id": "T-02"})
    assert res_same.status_code == 400

    # Nonexistent table POS lookup
    res_notfound = client.post("/api/v1/tables/T-02/transfer", json={"target_table_id": "T-999"})
    assert res_notfound.status_code == 400 or res_notfound.status_code == 404
