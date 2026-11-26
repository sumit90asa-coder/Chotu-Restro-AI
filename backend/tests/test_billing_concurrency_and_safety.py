import pytest
from decimal import Decimal
from datetime import datetime, timezone
from app.models.restaurant import Restaurant
from app.models.user import User
from app.models.table import DiningTable, TableStatus
from app.models.menu import MenuCategory, MenuItem
from app.models.order import Order, OrderItem, OrderStatus, PaymentStatus, OrderMode, PlacedBy
from app.models.payment import Payment
from app.services.order_service import OrderService
from app.core.security import create_access_token
from app.core.permissions import UserRole

@pytest.fixture
def billing_fixture(db_session):
    rest = Restaurant(
        id="rest-billing-qa",
        name="Billing QA Cafe",
        code="BILLQA",
        address="789 Marine Drive",
        city="Mumbai",
        phone="+919876500000",
        currency="INR"
    )
    db_session.add(rest)
    db_session.flush()

    user = User(
        id="user-csh-billing",
        restaurant_id=rest.id,
        email="cashier@billingqa.test",
        full_name="Cashier QA",
        hashed_password="hashed_pwd",
        role=UserRole.CASHIER,
        is_active=True
    )
    db_session.add(user)

    tbl = DiningTable(
        id="tbl-bill-01",
        restaurant_id=rest.id,
        label="Table 1",
        capacity=4,
        status=TableStatus.OCCUPIED,
        qr_token="qr-bill-01"
    )
    db_session.add(tbl)
    db_session.flush()

    cat = MenuCategory(id="cat-bill-01", restaurant_id=rest.id, name="Beverages", slug="beverages", display_order=1)
    db_session.add(cat)
    db_session.flush()

    dish = MenuItem(
        id="dish-chai-01",
        restaurant_id=rest.id,
        category_id=cat.id,
        name="Masala Chai",
        price=Decimal("50.00"),
        is_active=True,
        is_in_stock=True
    )
    db_session.add(dish)
    db_session.flush()

    order = Order(
        id="ord-bill-100",
        order_number="BILL-100",
        token_number="T-100",
        restaurant_id=rest.id,
        table_id=tbl.id,
        mode=OrderMode.DINE_IN,
        status=OrderStatus.PREPARING,
        payment_status=PaymentStatus.PENDING,
        subtotal=Decimal("100.00"),
        total_amount=Decimal("105.00"),
        placed_by=PlacedBy.POS,
        created_at=datetime.now(timezone.utc)
    )
    db_session.add(order)
    db_session.flush()

    tbl.current_order_id = order.id
    tbl.current_bill = order.total_amount

    oi = OrderItem(
        id="oi-bill-1",
        order_id=order.id,
        menu_item_id=dish.id,
        name="Masala Chai",
        quantity=2,
        price=Decimal("50.00"),
        created_at=datetime.now(timezone.utc)
    )
    db_session.add(oi)
    db_session.commit()

    return {"rest": rest, "user": user, "table": tbl, "order": order, "dish": dish}

def test_settle_bill_lifecycle_and_duplicate_prevention(client, db_session, billing_fixture):
    """Verifies that billing settlement marks table vacant, records payment, and rejects duplicates."""
    user = billing_fixture["user"]
    table = billing_fixture["table"]
    order = billing_fixture["order"]

    token = create_access_token(
        subject=user.id,
        extra_claims={"role": user.role.value, "restaurant_id": user.restaurant_id}
    )
    headers = {"Authorization": f"Bearer {token}"}

    # 1. First settlement request (Cashier 1)
    resp1 = client.post(
        f"/api/v1/pos/tables/{table.id}/settle",
        json={"payment_method": "cash"},
        headers=headers
    )
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["payment_status"] == "paid"
    assert data1["status"] == "completed"

    # Verify table state in database
    db_session.refresh(table)
    assert table.status == TableStatus.VACANT
    assert table.current_order_id is None
    assert table.current_bill == Decimal("0.00")

    # Verify exactly 1 payment record in ledger
    payments = db_session.query(Payment).filter(Payment.order_id == order.id).all()
    assert len(payments) == 1
    assert payments[0].amount == Decimal("105.00")

    # 2. Duplicate settlement request on the same table (Cashier 2 / Browser retry)
    # The table has now been vacated / order was settled
    resp2 = client.post(
        f"/api/v1/pos/tables/{table.id}/settle",
        json={"payment_method": "cash"},
        headers=headers
    )
    assert resp2.status_code == 409
    assert "already settled" in resp2.json()["detail"].lower() or "no active order" in resp2.json()["detail"].lower()

    # 3. Direct duplicate settlement attempt on the same order_id via OrderService
    with pytest.raises(ValueError, match="already been settled"):
        OrderService.settle_bill(db_session, order.id, payment_method="cash")

    # Verify payment ledger still has strictly 1 payment
    payments_after = db_session.query(Payment).filter(Payment.order_id == order.id).all()
    assert len(payments_after) == 1

def test_concurrent_settlement_thread_race(client, db_session, billing_fixture):
    """
    Spawns two simultaneous worker threads executing /tables/{table_id}/settle
    against the same un-settled order to verify database row-level locking
    and race condition prevention.
    """
    import concurrent.futures
    user = billing_fixture["user"]
    table = billing_fixture["table"]
    order = billing_fixture["order"]

    token = create_access_token(
        subject=user.id,
        extra_claims={"role": user.role.value, "restaurant_id": user.restaurant_id}
    )
    headers = {"Authorization": f"Bearer {token}"}

    results = []
    def settle_worker():
        return client.post(
            f"/api/v1/pos/tables/{table.id}/settle",
            json={"payment_method": "cash"},
            headers=headers
        )

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(settle_worker)
        f2 = executor.submit(settle_worker)
        results = [f1.result(), f2.result()]

    status_codes = sorted([r.status_code for r in results])
    # Exactly one request must succeed (200), and the competing request must be rejected (409)
    assert status_codes == [200, 409], f"Unexpected race condition status codes: {status_codes}"

    # Verify database state: exactly 1 payment record exists
    payments = db_session.query(Payment).filter(Payment.order_id == order.id).all()
    assert len(payments) == 1, f"CRITICAL: Duplicate payments created! Count = {len(payments)}"
