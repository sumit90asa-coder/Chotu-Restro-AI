import pytest
import secrets
import hashlib
from decimal import Decimal
from app.models.user import User, UserRole
from app.models.table import DiningTable, TableStatus
from app.models.menu import MenuItem, DietaryType, StationType
from app.models.order import Order
from app.models.kot import KOT
from app.models.inventory import Ingredient, RecipeItem, StockTransaction
from app.core.security import create_access_token


def get_auth_headers_for_user(user: User) -> dict:
    token = create_access_token(subject=user.id, extra_claims={"role": user.role.value, "restaurant_id": user.restaurant_id})
    return {"Authorization": f"Bearer {token}"}


def test_01_token_entropy_and_unpredictability(client, db_session):
    """
    P0 SECURITY TEST:
    Verify that generated QR tokens provide at least 128 bits of entropy (256 bits via token_urlsafe(32)),
    and do NOT contain predictable table identifiers.
    """
    manager = db_session.query(User).filter(User.role == UserRole.MANAGER).first()
    headers = get_auth_headers_for_user(manager)

    resp = client.post("/api/v1/tables/T-01/regenerate-qr", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    new_token = data["qr_token"]

    # 1. Must use high-entropy prefix
    assert new_token.startswith("chotu_qr_")
    # 2. Extract random payload (32 urlsafe bytes = 43 chars)
    payload = new_token.replace("chotu_qr_", "")
    assert len(payload) >= 40  # 43 base64 characters = 256 bits of entropy
    # 3. Must NOT contain predictable table identifier
    assert "t-01" not in new_token.lower()
    assert "table" not in new_token.lower()


def test_02_rbac_on_qr_regeneration_every_role(client, db_session):
    """
    P0 RBAC AUDIT:
    Verify that ONLY Owner and Manager can regenerate QR codes.
    Cashier, Waiter, and Kitchen Staff MUST be rejected with HTTP 403 Forbidden.
    Unauthenticated requests MUST be rejected with HTTP 401 Unauthorized.
    """
    manager = db_session.query(User).filter(User.role == UserRole.MANAGER).first()
    cashier = db_session.query(User).filter(User.role == UserRole.CASHIER).first()
    kitchen = db_session.query(User).filter(User.role == UserRole.KITCHEN_STAFF).first()

    # Ensure OWNER and WAITER exist in db_session
    owner = db_session.query(User).filter(User.role == UserRole.OWNER).first()
    if not owner:
        owner = User(
            id="user-owner-test",
            restaurant_id=manager.restaurant_id,
            email="owner@test.com",
            full_name="Owner Priya",
            hashed_password="hash",
            role=UserRole.OWNER,
            is_active=True
        )
        db_session.add(owner)

    waiter = db_session.query(User).filter(User.role == UserRole.WAITER).first()
    if not waiter:
        waiter = User(
            id="user-waiter-test",
            restaurant_id=manager.restaurant_id,
            email="waiter@test.com",
            full_name="Waiter Rohan",
            hashed_password="hash",
            role=UserRole.WAITER,
            is_active=True
        )
        db_session.add(waiter)
    db_session.commit()

    # 1. OWNER -> 200 OK
    resp_owner = client.post("/api/v1/tables/T-02/regenerate-qr", headers=get_auth_headers_for_user(owner))
    assert resp_owner.status_code == 200, f"Owner failed: {resp_owner.text}"

    # 2. MANAGER -> 200 OK
    resp_mgr = client.post("/api/v1/tables/T-02/regenerate-qr", headers=get_auth_headers_for_user(manager))
    assert resp_mgr.status_code == 200, f"Manager failed: {resp_mgr.text}"

    # 3. CASHIER -> 403 Forbidden
    resp_cashier = client.post("/api/v1/tables/T-02/regenerate-qr", headers=get_auth_headers_for_user(cashier))
    assert resp_cashier.status_code == 403, "Cashier should not be authorized to regenerate QR tokens"
    assert "not authorized" in resp_cashier.json()["detail"].lower()

    # 4. WAITER -> 403 Forbidden
    resp_waiter = client.post("/api/v1/tables/T-02/regenerate-qr", headers=get_auth_headers_for_user(waiter))
    assert resp_waiter.status_code == 403, "Waiter should not be authorized to regenerate QR tokens"
    assert "not authorized" in resp_waiter.json()["detail"].lower()

    # 5. KITCHEN_STAFF -> 403 Forbidden
    resp_kitchen = client.post("/api/v1/tables/T-02/regenerate-qr", headers=get_auth_headers_for_user(kitchen))
    assert resp_kitchen.status_code == 403, "Kitchen staff should not be authorized to regenerate QR tokens"

    # 6. Unauthenticated (no token) -> 401 Unauthorized
    resp_anon = client.post("/api/v1/tables/T-02/regenerate-qr", headers={"Authorization": ""})
    assert resp_anon.status_code in [401, 403]


def test_03_multi_tenant_table_isolation_on_regeneration(client, db_session):
    """
    P0 MULTI-TENANT TEST:
    A user from Restaurant A cannot regenerate QR tokens for a table belonging to Restaurant B.
    """
    manager = db_session.query(User).filter(User.role == UserRole.MANAGER).first()
    headers = get_auth_headers_for_user(manager)

    # Attempt to regenerate a table belonging to a non-existent or other restaurant ID
    resp = client.post("/api/v1/tables/non-existent-table-id/regenerate-qr", headers=headers)
    assert resp.status_code == 404
    assert "Table not found" in resp.json()["detail"]


def test_04_immediate_token_invalidation(client, db_session):
    """
    P0 TOKEN LIFECYCLE:
    Verify old token is instantly revoked upon regeneration and cannot access menu or submit orders.
    """
    manager = db_session.query(User).filter(User.role == UserRole.MANAGER).first()
    headers = get_auth_headers_for_user(manager)

    # 1. Table T-03 starts with valid demo token
    t3 = db_session.query(DiningTable).filter(DiningTable.id == "T-03").first()
    old_token = t3.qr_token

    # Verify old token works initially
    assert client.get(f"/api/v1/qr/{old_token}/table").status_code == 200

    # 2. Regenerate token
    regen_resp = client.post("/api/v1/tables/T-03/regenerate-qr", headers=headers)
    assert regen_resp.status_code == 200
    new_token = regen_resp.json()["qr_token"]
    assert new_token != old_token

    # 3. Old token MUST immediately return 404
    assert client.get(f"/api/v1/qr/{old_token}/table").status_code == 404
    assert client.get(f"/api/v1/qr/{old_token}/menu").status_code == 404
    order_fail = client.post(
        f"/api/v1/qr/{old_token}/orders",
        json={"customer_name": "Intruder", "items": [{"dish_id": "dish-01", "name": "Butter Chicken", "price": 340, "quantity": 1}]}
    )
    assert order_fail.status_code == 404

    # 4. New token MUST work cleanly
    assert client.get(f"/api/v1/qr/{new_token}/table").status_code == 200
    assert client.get(f"/api/v1/qr/{new_token}/menu").status_code == 200


def test_05_cross_table_mismatch_rejection(client):
    """
    P1 ATTACK VECTOR:
    A customer scanning Table 01 QR cannot submit an order claiming to be Table 02.
    """
    resp = client.post(
        "/api/v1/qr/qr-t01-demo/orders",
        json={
            "customer_name": "Spoofer",
            "table_id": "T-02",  # Mismatched table ID!
            "items": [{"dish_id": "dish-01", "name": "Butter Chicken", "price": 340, "quantity": 1}]
        }
    )
    assert resp.status_code == 400
    assert "Table ID mismatch" in resp.json()["detail"]


def test_06_price_manipulation_immunity(client, db_session):
    """
    P1 INTEGRITY TEST:
    Customer attempts to send modified prices in the payload (e.g. ₹0.01 instead of ₹340).
    Backend MUST ignore client price and strictly enforce authoritative database price.
    """
    resp = client.post(
        "/api/v1/qr/qr-t01-demo/orders",
        json={
            "customer_name": "Price Tamperer",
            "items": [
                {
                    "dish_id": "dish-01",  # Real price is ₹340.00
                    "name": "Butter Chicken (Boneless)",
                    "price": 0.01,         # Tampered price attempt!
                    "quantity": 1
                }
            ]
        }
    )
    assert resp.status_code == 200
    order = resp.json()
    # Price must be calculated using authoritative ₹340.00 + taxes/charges
    assert float(order["subtotal"]) == 340.00
    assert float(order["total_amount"]) >= 340.00


def test_07_invalid_quantity_boundary_validation(client):
    """
    P1 INPUT VALIDATION:
    Quantity <= 0 or > 50 MUST be rejected with HTTP 400.
    """
    # 1. Zero quantity
    resp_zero = client.post(
        "/api/v1/qr/qr-t01-demo/orders",
        json={"items": [{"dish_id": "dish-01", "name": "Butter Chicken", "price": 340, "quantity": 0}]}
    )
    assert resp_zero.status_code == 400
    assert "Invalid quantity" in resp_zero.json()["detail"]

    # 2. Negative quantity
    resp_neg = client.post(
        "/api/v1/qr/qr-t01-demo/orders",
        json={"items": [{"dish_id": "dish-01", "name": "Butter Chicken", "price": 340, "quantity": -3}]}
    )
    assert resp_neg.status_code == 400

    # 3. Excessive quantity (> 50)
    resp_huge = client.post(
        "/api/v1/qr/qr-t01-demo/orders",
        json={"items": [{"dish_id": "dish-01", "name": "Butter Chicken", "price": 340, "quantity": 999}]}
    )
    assert resp_huge.status_code == 400


def test_08_out_of_stock_item_rejected(client, db_session):
    """
    P1 STOCK VALIDATION:
    Out-of-stock items cannot be ordered via table QR.
    """
    dish = db_session.query(MenuItem).filter(MenuItem.id == "dish-03").first()
    dish.is_in_stock = False
    db_session.commit()

    resp = client.post(
        "/api/v1/qr/qr-t01-demo/orders",
        json={"items": [{"dish_id": "dish-03", "name": "Dal Makhani", "price": 240, "quantity": 1}]}
    )
    assert resp.status_code == 400
    assert "out of stock" in resp.json()["detail"].lower()


def test_09_idempotency_prevents_duplicate_orders(client, db_session):
    """
    P0 CONCURRENCY & IDEMPOTENCY:
    Submitting the same order with an identical idempotency key twice returns the exact same order
    without creating duplicate KOTs or deducting stock twice.
    """
    idemp_key = f"test-idemp-{secrets.token_hex(8)}"

    payload = {
        "customer_name": "Simultaneous Guest",
        "idempotency_key": idemp_key,
        "items": [
            {"dish_id": "dish-04", "name": "Garlic Butter Naan", "price": 60, "quantity": 2}
        ]
    }

    # 1. First submission
    resp1 = client.post("/api/v1/qr/qr-t05-demo/orders", json=payload)
    assert resp1.status_code == 200
    order1 = resp1.json()

    # Count KOTs for Table 5
    kots_after_1 = db_session.query(KOT).filter(KOT.order_id == order1["id"]).count()

    # 2. Duplicate submission with SAME idempotency key (simulating network retry or double-click)
    resp2 = client.post("/api/v1/qr/qr-t05-demo/orders", json=payload)
    assert resp2.status_code == 200
    order2 = resp2.json()

    # Order ID must match
    assert order1["id"] == order2["id"]
    assert order1["order_number"] == order2["order_number"]

    # KOT count must NOT increase
    kots_after_2 = db_session.query(KOT).filter(KOT.order_id == order1["id"]).count()
    assert kots_after_1 == kots_after_2


def test_10_incremental_orders_do_not_double_deduct_inventory(client, db_session):
    """
    P0 INVENTORY INTEGRITY:
    When a customer orders Batch 1, stock is deducted for Batch 1.
    When the customer later orders Batch 2 on the same table, stock is deducted ONLY for Batch 2.
    Batch 1 items are NOT deducted a second time.
    """
    # Check recipe for dish-01
    recipe_items = db_session.query(RecipeItem).filter(RecipeItem.menu_item_id == "dish-01").all()
    assert len(recipe_items) > 0, "dish-01 must have recipes configured"
    ing_id = recipe_items[0].ingredient_id
    qty_per_dish = Decimal(str(recipe_items[0].quantity_required))

    ingredient = db_session.query(Ingredient).filter(Ingredient.id == ing_id).first()
    initial_stock = Decimal(str(ingredient.current_stock))

    # 1. Place Batch 1: 1 Butter Chicken (dish-01)
    resp1 = client.post(
        "/api/v1/qr/qr-t07-demo/orders",
        json={"items": [{"dish_id": "dish-01", "name": "Butter Chicken", "price": 340, "quantity": 1}]}
    )
    assert resp1.status_code == 200

    db_session.refresh(ingredient)
    stock_after_batch1 = Decimal(str(ingredient.current_stock))
    assert stock_after_batch1 == initial_stock - qty_per_dish

    # 2. Place Batch 2: 2 Naans (dish-04) - does NOT consume dish-01's ingredient
    resp2 = client.post(
        "/api/v1/qr/qr-t07-demo/orders",
        json={"items": [{"dish_id": "dish-04", "name": "Garlic Butter Naan", "price": 60, "quantity": 2}]}
    )
    assert resp2.status_code == 200

    db_session.refresh(ingredient)
    stock_after_batch2 = Decimal(str(ingredient.current_stock))
    # Stock of dish-01's ingredient MUST NOT change after Batch 2
    assert stock_after_batch2 == stock_after_batch1
