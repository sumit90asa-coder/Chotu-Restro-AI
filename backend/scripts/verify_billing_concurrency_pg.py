import sys
import os
import time
import threading
from decimal import Decimal
from datetime import datetime, timezone

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.session import SessionLocal, engine
from app.models.restaurant import Restaurant
from app.models.user import User
from app.models.table import DiningTable, TableStatus
from app.models.menu import MenuCategory, MenuItem
from app.models.order import Order, OrderItem, OrderStatus, PaymentStatus, OrderMode, PlacedBy
from app.models.payment import Payment
from app.models.customer import Customer, LoyaltyTransaction
from app.core.security import create_access_token
from app.core.permissions import UserRole
from fastapi.testclient import TestClient
from app.main import app

def run_concurrency_verification():
    print("=" * 70)
    print("CHOTU RESTRO AI — INDEPENDENT POSTGRESQL BILLING CONCURRENCY AUDIT")
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print(f"Database Engine: {engine.url}")
    print("=" * 70)

    db = SessionLocal()
    unique_suffix = int(time.time())
    rest_id = f"rest-conc-{unique_suffix}"
    table_id = f"tbl-conc-{unique_suffix}"
    order_id = f"ord-conc-{unique_suffix}"
    customer_id = f"cust-conc-{unique_suffix}"
    user_id = f"user-csh-{unique_suffix}"
    cat_id = f"cat-{unique_suffix}"
    dish_id = f"dish-{unique_suffix}"

    try:
        # 1. Setup isolated test restaurant, table, customer, user, order
        rest = Restaurant(
            id=rest_id,
            name="Concurrency Test Lounge",
            code=f"C{unique_suffix % 10000}",
            address="123 Concurrency Blvd",
            city="Pune",
            phone=f"+9199{unique_suffix % 100000000:08d}",
            currency="INR"
        )
        db.add(rest)

        customer = Customer(
            id=customer_id,
            restaurant_id=rest_id,
            name="Concurrent VIP",
            phone="+919876543210",
            loyalty_points_balance=100
        )
        db.add(customer)

        user = User(
            id=user_id,
            restaurant_id=rest_id,
            email=f"cashier.{unique_suffix}@concurrency.test",
            full_name="Concurrent Cashier",
            hashed_password="mock_hash_for_test",
            role=UserRole.CASHIER,
            is_active=True
        )
        db.add(user)

        tbl = DiningTable(
            id=table_id,
            restaurant_id=rest_id,
            label="Table CC-1",
            capacity=4,
            status=TableStatus.OCCUPIED,
            qr_token=f"qr-{unique_suffix}",
            floor_name="Main Hall"
        )
        db.add(tbl)
        db.flush()

        cat = MenuCategory(
            id=cat_id,
            restaurant_id=rest_id,
            name="Main Course",
            slug=f"main-{unique_suffix}",
            display_order=1
        )
        db.add(cat)
        db.flush()

        dish = MenuItem(
            id=dish_id,
            restaurant_id=rest_id,
            category_id=cat.id,
            name="Tandoori Platter",
            price=Decimal("500.00"),
            is_active=True,
            is_in_stock=True
        )
        db.add(dish)
        db.flush()

        order = Order(
            id=order_id,
            order_number=f"ORD-{unique_suffix}",
            token_number="T-01",
            restaurant_id=rest_id,
            table_id=table_id,
            customer_id=customer_id,
            mode=OrderMode.DINE_IN,
            status=OrderStatus.PREPARING,
            payment_status=PaymentStatus.PENDING,
            subtotal=Decimal("500.00"),
            cgst=Decimal("12.50"),
            sgst=Decimal("12.50"),
            total_amount=Decimal("525.00"),
            placed_by=PlacedBy.POS,
            created_at=datetime.now(timezone.utc)
        )
        db.add(order)
        db.flush()

        tbl.current_order_id = order.id
        tbl.current_bill = order.total_amount

        oi = OrderItem(
            id=f"oi-{unique_suffix}",
            order_id=order_id,
            menu_item_id=dish.id,
            name="Tandoori Platter",
            quantity=1,
            price=Decimal("500.00"),
            created_at=datetime.now(timezone.utc)
        )
        db.add(oi)
        db.commit()

        print(f"\n[SETUP SUCCESS] Order {order_id} created for Table {table_id}. Total: ₹{order.total_amount}")
        print(f"Customer Initial Loyalty: {customer.loyalty_points_balance} pts")
        print(f"Table Status: {tbl.status.value}")

        # Generate auth token for Cashier
        token = create_access_token(
            subject=user.id,
            extra_claims={"role": user.role.value, "restaurant_id": user.restaurant_id}
        )
        headers = {"Authorization": f"Bearer {token}"}

        # Barrier to synchronize simultaneous dispatch
        barrier = threading.Barrier(2)
        responses = []

        def execute_settlement(worker_id):
            client = TestClient(app)
            # Wait for both threads to hit the barrier before issuing HTTP request
            barrier.wait()
            start_t = time.perf_counter()
            resp = client.post(
                f"/api/v1/pos/tables/{table_id}/settle",
                json={"payment_method": "upi"},
                headers=headers
            )
            elapsed_ms = (time.perf_counter() - start_t) * 1000
            responses.append({
                "worker": worker_id,
                "status_code": resp.status_code,
                "body": resp.json(),
                "elapsed_ms": elapsed_ms
            })

        print("\n--- INITIATING DUAL CONCURRENT SETTLEMENT RACE ---")
        t1 = threading.Thread(target=execute_settlement, args=("Thread-A (Cashier Terminal 1)",))
        t2 = threading.Thread(target=execute_settlement, args=("Thread-B (Cashier Terminal 2)",))

        t1.start()
        t2.start()
        t1.join()
        t2.join()

        print("\n=== CONCURRENT HTTP RESPONSES ===")
        for r in responses:
            print(f"Worker: {r['worker']}")
            print(f"  Status Code: {r['status_code']}")
            print(f"  Response Body: {r['body']}")
            print(f"  Latency: {r['elapsed_ms']:.2f} ms")

        # Verify in fresh DB session
        verify_db = SessionLocal()
        order_final = verify_db.query(Order).filter(Order.id == order_id).first()
        table_final = verify_db.query(DiningTable).filter(DiningTable.id == table_id).first()
        payments = verify_db.query(Payment).filter(Payment.order_id == order_id).all()
        customer_final = verify_db.query(Customer).filter(Customer.id == customer_id).first()
        loyalty_txs = verify_db.query(LoyaltyTransaction).filter(LoyaltyTransaction.customer_id == customer_id).all()

        print("\n=== POSTGRESQL POST-CONCURRENCY DATABASE AUDIT ===")
        print(f"Final Order Status: {order_final.status.value}")
        print(f"Final Payment Status: {order_final.payment_status.value}")
        print(f"Final Table Status: {table_final.status.value}")
        print(f"Final Table Current Order ID: {table_final.current_order_id}")
        print(f"Final Table Current Bill: {table_final.current_bill}")
        print(f"Ledger Payments Recorded: {len(payments)}")
        for idx, p in enumerate(payments, 1):
            print(f"  Payment #{idx}: ID={p.id}, Amount=₹{p.amount}, Method={p.method.value}, Status={p.status.value}, Ref={p.transaction_ref}")
        print(f"Customer Final Loyalty Points: {customer_final.loyalty_points_balance} pts (Earned: {customer_final.loyalty_points_balance - 100} pts)")
        print(f"Loyalty Transactions Recorded: {len(loyalty_txs)}")

        status_codes = sorted([r["status_code"] for r in responses])
        assert status_codes == [200, 409], f"FAILURE: Status codes expected [200, 409], got {status_codes}"
        assert len(payments) == 1, f"FAILURE: Duplicate payments recorded! Expected 1, got {len(payments)}"
        assert order_final.payment_status == PaymentStatus.PAID, "FAILURE: Order payment status not PAID"
        assert order_final.status == OrderStatus.COMPLETED, "FAILURE: Order status not COMPLETED"
        assert table_final.status == TableStatus.VACANT, "FAILURE: Table status not VACANT"
        assert table_final.current_order_id is None, "FAILURE: Table current_order_id not cleared"

        print("\n[VERDICT: PASS] CONCURRENCY INTEGRITY FULLY VERIFIED.")
        print("  - Exactly one settlement won (HTTP 200)")
        print("  - Exactly one settlement rejected (HTTP 409 Conflict)")
        print("  - Exactly 1 payment record created in ledger")
        print("  - Table safely released to VACANT with zero lingering balance")
        verify_db.close()

    finally:
        # Cleanup test records to leave database completely clean
        cleanup_db = SessionLocal()
        try:
            cleanup_db.query(Payment).filter(Payment.order_id == order_id).delete()
            cleanup_db.query(LoyaltyTransaction).filter(LoyaltyTransaction.customer_id == customer_id).delete()
            cleanup_db.query(OrderItem).filter(OrderItem.order_id == order_id).delete()
            cleanup_db.query(Order).filter(Order.id == order_id).delete()
            cleanup_db.query(DiningTable).filter(DiningTable.id == table_id).delete()
            cleanup_db.query(MenuItem).filter(MenuItem.id == dish_id).delete()
            cleanup_db.query(MenuCategory).filter(MenuCategory.id == cat_id).delete()
            cleanup_db.query(Customer).filter(Customer.id == customer_id).delete()
            cleanup_db.query(User).filter(User.id == user_id).delete()
            cleanup_db.query(Restaurant).filter(Restaurant.id == rest_id).delete()
            cleanup_db.commit()
            print(f"\n[CLEANUP] All temporary test records for {rest_id} safely purged.")
        except Exception as e:
            cleanup_db.rollback()
            print(f"[CLEANUP ERROR] {e}")
        finally:
            cleanup_db.close()
            db.close()

if __name__ == "__main__":
    run_concurrency_verification()
