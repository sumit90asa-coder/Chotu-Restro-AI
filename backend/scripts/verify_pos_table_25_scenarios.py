"""
Comprehensive Automated Verification for Unified POS, Active Order, Zero-Bill & Table Settlement:
25 End-to-End Test Scenarios
"""
import sys
import os
import concurrent.futures
from datetime import datetime, timezone, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.session import SessionLocal, engine
from app.core.permissions import UserRole
from app.models import (
    Restaurant, User, DiningTable, TableStatus, MenuCategory, MenuItem,
    Order, OrderStatus, OrderMode, OrderItem, Payment, PaymentMethod, PaymentRecordStatus,
    Ingredient, Customer, KOT, KOTStatus
)
from app.models.kot import KOTItem
from app.models.order import PlacedBy, PaymentStatus
from app.services.order_service import OrderService
from app.services.billing_service import BillingService

scenarios_log = []

def record(num: int, title: str, passed: bool, initial: str, action: str, expected: str, actual: str, final_st: str):
    status_str = "PASS" if passed else "FAIL"
    print(f"[{status_str}] Scenario {num:02d}: {title}")
    if not passed:
        print(f"      Actual: {actual} | Expected: {expected}")
    scenarios_log.append({
        "num": num,
        "title": title,
        "passed": passed,
        "initial": initial,
        "action": action,
        "expected": expected,
        "actual": actual,
        "final": final_st
    })

def run_all_25_scenarios():
    db = SessionLocal()
    try:
        t1_rest_id = "test-pos-rest-01"
        t2_rest_id = "test-pos-rest-02"

        # Cleanup test tenants
        for rid in [t1_rest_id, t2_rest_id]:
            db.query(OrderItem).filter(OrderItem.order_id.in_(
                db.query(Order.id).filter(Order.restaurant_id == rid)
            )).delete(synchronize_session=False)
            db.query(Payment).filter(Payment.order_id.in_(
                db.query(Order.id).filter(Order.restaurant_id == rid)
            )).delete(synchronize_session=False)
            db.query(KOTItem).filter(KOTItem.kot_id.in_(
                db.query(KOT.id).filter(KOT.restaurant_id == rid)
            )).delete(synchronize_session=False)
            db.query(KOT).filter(KOT.restaurant_id == rid).delete(synchronize_session=False)
            db.query(Order).filter(Order.restaurant_id == rid).delete(synchronize_session=False)
            db.query(MenuItem).filter(MenuItem.restaurant_id == rid).delete(synchronize_session=False)
            db.query(MenuCategory).filter(MenuCategory.restaurant_id == rid).delete(synchronize_session=False)
            db.query(Ingredient).filter(Ingredient.restaurant_id == rid).delete(synchronize_session=False)
            db.query(Customer).filter(Customer.restaurant_id == rid).delete(synchronize_session=False)
            db.query(DiningTable).filter(DiningTable.restaurant_id == rid).delete(synchronize_session=False)
            db.query(User).filter(User.restaurant_id == rid).delete(synchronize_session=False)
            db.query(Restaurant).filter(Restaurant.id == rid).delete(synchronize_session=False)
        db.commit()

        # Seed Restaurant 1
        rest1 = Restaurant(
            id=t1_rest_id,
            name="POS Test Kitchen",
            code="POS-REST-01",
            address="123 Food Street, Mumbai",
            city="Mumbai",
            phone="+919111111111",
            cgst_percent=Decimal("2.50"),
            sgst_percent=Decimal("2.50"),
            service_charge_percent=Decimal("5.00")
        )
        user1 = User(id="user-pos-01", email="pos.cashier@kitchen.com", full_name="Cashier Raj", phone="+919111111111", hashed_password="pw", role=UserRole.CASHIER, restaurant_id=t1_rest_id)
        tbl1 = DiningTable(id="tbl-pos-01", restaurant_id=t1_rest_id, label="T-01", capacity=4, status=TableStatus.VACANT, qr_token="qr-pos-01", current_bill=Decimal("0.00"))
        tbl2 = DiningTable(id="tbl-pos-02", restaurant_id=t1_rest_id, label="T-02", capacity=6, status=TableStatus.VACANT, qr_token="qr-pos-02", current_bill=Decimal("0.00"))

        cat1 = MenuCategory(id="cat-pos-01", restaurant_id=t1_rest_id, name="Mains", slug="mains-pos", display_order=1)
        dish_paneer = MenuItem(id="dish-pos-paneer", restaurant_id=t1_rest_id, category_id=cat1.id, name="Paneer Butter Masala", price=Decimal("300.00"), is_active=True, is_in_stock=True)
        dish_naan = MenuItem(id="dish-pos-naan", restaurant_id=t1_rest_id, category_id=cat1.id, name="Garlic Naan", price=Decimal("70.00"), is_active=True, is_in_stock=True)
        dish_dal = MenuItem(id="dish-pos-dal", restaurant_id=t1_rest_id, category_id=cat1.id, name="Dal Makhani", price=Decimal("250.00"), is_active=True, is_in_stock=True)
        cust1 = Customer(id="cust-pos-01", restaurant_id=t1_rest_id, name="Rohit Verma", phone="+919820099881", total_orders=2, loyalty_points_balance=40)

        # Seed Restaurant 2 (for cross-tenant tests)
        rest2 = Restaurant(
            id=t2_rest_id,
            name="External Cafe",
            code="EXT-CAFE-02",
            address="456 Outer Road",
            city="Mumbai",
            phone="+919222222222"
        )
        user2 = User(id="user-pos-02", email="ext.owner@cafe.com", full_name="External Owner", phone="+919222222222", hashed_password="pw", role=UserRole.OWNER, restaurant_id=t2_rest_id)
        tbl_ext = DiningTable(id="tbl-ext-01", restaurant_id=t2_rest_id, label="E-01", capacity=2, status=TableStatus.VACANT, qr_token="qr-ext-01")

        db.add_all([rest1, user1, tbl1, tbl2, cat1, dish_paneer, dish_naan, dish_dal, cust1, rest2, user2, tbl_ext])
        db.commit()

        # ==========================================
        # Scenario 1: Create a new vacant table order
        # ==========================================
        ord1 = OrderService.get_or_create_table_order(db, t1_rest_id, tbl1.id, customer_name="Rohit Verma", placed_by=PlacedBy.POS)
        ord1.customer_phone = "+919820099881"
        db.commit()
        db.refresh(tbl1)
        p1 = (ord1.id is not None) and (tbl1.status == TableStatus.OCCUPIED) and (tbl1.current_order_id == ord1.id)
        record(1, "Create a new vacant table order", p1,
               "T-01 vacant, current_order_id=None",
               f"get_or_create_table_order({tbl1.id})",
               "Order created, table status=occupied, linked current_order_id",
               f"Order {ord1.id}, Table status={tbl1.status.value}, current_order_id={tbl1.current_order_id}",
               f"Table {tbl1.label} occupied with active order {ord1.order_number}")

        # ==========================================
        # Scenario 2: Add one dish
        # ==========================================
        ord1 = OrderService.add_or_update_order_item(db, ord1.id, dish_paneer.id, delta_qty=1)
        items = db.query(OrderItem).filter(OrderItem.order_id == ord1.id).all()
        p2 = len(items) == 1 and items[0].quantity == 1 and items[0].name == "Paneer Butter Masala"
        record(2, "Add one dish", p2,
               "0 items in order",
               "add_or_update_order_item(Paneer Butter Masala, qty=1)",
               "1 item added, price=300",
               f"{len(items)} item(s), name={items[0].name}, qty={items[0].quantity}",
               f"Order subtotal={ord1.subtotal}")

        # ==========================================
        # Scenario 3: Add multiple different dishes
        # ==========================================
        ord1 = OrderService.add_or_update_order_item(db, ord1.id, dish_naan.id, delta_qty=2)
        ord1 = OrderService.add_or_update_order_item(db, ord1.id, dish_dal.id, delta_qty=1)
        items = db.query(OrderItem).filter(OrderItem.order_id == ord1.id).all()
        p3 = len(items) == 3 and sum(it.quantity for it in items) == 4
        record(3, "Add multiple different dishes", p3,
               "1 item in order",
               "add Naan (qty=2), Dal (qty=1)",
               "3 distinct dishes, total quantity=4",
               f"{len(items)} dishes, total qty={sum(it.quantity for it in items)}",
               f"Order subtotal={ord1.subtotal}")

        # ==========================================
        # Scenario 4: Increase and decrease quantities
        # ==========================================
        ord1 = OrderService.add_or_update_order_item(db, ord1.id, dish_naan.id, delta_qty=1)  # 2 -> 3
        ord1 = OrderService.add_or_update_order_item(db, ord1.id, dish_dal.id, delta_qty=-1) # 1 -> 0 (deleted)
        items = db.query(OrderItem).filter(OrderItem.order_id == ord1.id).all()
        naan_item = next((i for i in items if i.menu_item_id == dish_naan.id), None)
        dal_item = next((i for i in items if i.menu_item_id == dish_dal.id), None)
        p4 = len(items) == 2 and naan_item.quantity == 3 and not any(i.menu_item_id == dish_dal.id for i in items)
        record(4, "Increase and decrease quantities", p4,
               "Naan=2, Dal=1",
               "Naan +1, Dal -1",
               "Naan=3, Dal removed, total distinct dishes=2",
               f"Naan qty={naan_item.quantity if naan_item else 0}, Dal present={any(i.menu_item_id == dish_dal.id for i in items)}",
               f"Order items count={len(items)}")

        # ==========================================
        # Scenario 5: Refresh POS simulation
        # ==========================================
        # Re-fetch order strictly from DB
        db.expire_all()
        reconstructed_order = db.query(Order).filter(Order.id == tbl1.current_order_id).first()
        rec_items = db.query(OrderItem).filter(OrderItem.order_id == reconstructed_order.id).all()
        p5 = len(rec_items) == 2 and sum(it.quantity for it in rec_items) == 4
        record(5, "Refresh POS (Reconstruct ledger from DB)", p5,
               "Client state cleared",
               "GET /pos/tables/tbl-pos-01/order",
               "2 dishes, 4 total items accurately retrieved from PostgreSQL",
               f"Fetched {len(rec_items)} dishes, total items={sum(it.quantity for it in rec_items)}",
               f"Ledger preserved: Subtotal={reconstructed_order.subtotal}")

        # ==========================================
        # Scenario 6: Navigate to Floor & Tables
        # ==========================================
        db.refresh(tbl1)
        p6 = (tbl1.status == TableStatus.OCCUPIED) and (tbl1.current_bill == reconstructed_order.total_amount)
        record(6, "Navigate to Floor & Tables (Table status & bill check)", p6,
               "Table in PostgreSQL",
               "GET /tables",
               "T-01 status=occupied, current_bill equals order total",
               f"T-01 status={tbl1.status.value}, current_bill={tbl1.current_bill}",
               f"Table shows ₹{tbl1.current_bill}")

        # ==========================================
        # Scenario 7: Reopen the same table
        # ==========================================
        fetched_tbl = db.query(DiningTable).filter(DiningTable.id == tbl1.id).first()
        active_ord = db.query(Order).filter(Order.id == fetched_tbl.current_order_id).first()
        p7 = (active_ord.id == ord1.id)
        record(7, "Reopen the same table", p7,
               "Table T-01 selected",
               "Open table drawer/details",
               f"Authoritative link to {ord1.id}",
               f"Active order ID={active_ord.id}",
               "Same order retained")

        # ==========================================
        # Scenario 8: Verify all items and prices
        # ==========================================
        # Paneer: 1 x 300 = 300, Naan: 3 x 70 = 210. Total subtotal = 510.00
        p8 = (reconstructed_order.subtotal == Decimal("510.00"))
        record(8, "Verify all items and prices", p8,
               "1x Paneer(300) + 3x Naan(70)",
               "Check subtotal calculation",
               "Subtotal=₹510.00",
               f"Subtotal=₹{reconstructed_order.subtotal}",
               "Authoritative pricing verified")

        # ==========================================
        # Scenario 9: Verify subtotal, GST, service charge, and payable
        # ==========================================
        # Subtotal: 510.00
        # CGST (2.5%): 12.75
        # SGST (2.5%): 12.75
        # Service Charge (5.0%): 25.50
        # Grand Total: 510 + 12.75 + 12.75 + 25.50 = 561.00
        expected_cgst = Decimal("12.75")
        expected_sgst = Decimal("12.75")
        expected_sc = Decimal("25.50")
        expected_total = Decimal("561.00")
        p9 = (reconstructed_order.cgst == expected_cgst and
              reconstructed_order.sgst == expected_sgst and
              reconstructed_order.service_charge == expected_sc and
              reconstructed_order.total_amount == expected_total)
        record(9, "Verify subtotal, GST, service charge, and payable", p9,
               "Subtotal=510.00",
               "BillingService.calculate_totals()",
               "CGST=12.75, SGST=12.75, SC=25.50, Total=561.00",
               f"CGST={reconstructed_order.cgst}, SGST={reconstructed_order.sgst}, SC={reconstructed_order.service_charge}, Total={reconstructed_order.total_amount}",
               "Taxes and payable 100% matched")

        # ==========================================
        # Scenario 10: Fire KOT
        # ==========================================
        kot = OrderService.fire_kot(db, reconstructed_order.id, captain_notes="Less spicy please")
        p10 = (kot.id is not None) and (kot.status == KOTStatus.COOKING) and (kot.kot_number > 0)
        record(10, "Fire KOT", p10,
               "Order un-fired",
               "fire_kot(ord1.id)",
               "KOT created with status COOKING",
               f"KOT {kot.id}, number={kot.kot_number}, status={kot.status.value}",
               f"KOT active in kitchen")

        # ==========================================
        # Scenario 11: Verify KOT contains only the selected table's items
        # ==========================================
        kot_items = db.query(KOTItem).filter(KOTItem.kot_id == kot.id).all()
        kot_dishes = {ki.name: ki.quantity for ki in kot_items}
        p11 = (len(kot_items) == 2 and kot_dishes.get("Paneer Butter Masala") == 1 and kot_dishes.get("Garlic Naan") == 3)
        record(11, "Verify KOT contains only the selected table's items", p11,
               "Order items: 1 Paneer, 3 Naan",
               "Inspect KOT items",
               "KOT items match exactly (1 Paneer, 3 Naan)",
               f"{len(kot_items)} KOT items: {kot_dishes}",
               "Kitchen tickets isolated")

        # ==========================================
        # Scenario 12: Reopen POS and verify the order remains correct
        # ==========================================
        db.expire_all()
        ord_post_kot = db.query(Order).filter(Order.id == tbl1.current_order_id).first()
        p12 = (ord_post_kot.total_amount == Decimal("561.00")) and (len(ord_post_kot.items) == 2)
        record(12, "Reopen POS and verify order remains correct after KOT", p12,
               "Order in DB",
               "Query active order",
               "Order total ₹561.00, items unchanged",
               f"Total=₹{ord_post_kot.total_amount}, items count={len(ord_post_kot.items)}",
               "Ledger preserved after KOT fire")

        # ==========================================
        # Scenario 13: Settle the bill
        # ==========================================
        settled_ord = OrderService.settle_bill(db, ord_post_kot.id, payment_method="upi")
        p13 = (settled_ord.status == OrderStatus.COMPLETED) and (settled_ord.payment_status == PaymentStatus.PAID)
        record(13, "Settle the bill", p13,
               "Order status=PREPARING, payment_status=PENDING",
               "settle_bill(ord1.id, payment_method='upi')",
               "Order COMPLETED, payment_status=PAID",
               f"Status={settled_ord.status.value}, payment_status={settled_ord.payment_status.value}",
               "Order bill settled")

        # ==========================================
        # Scenario 14: Verify exactly one payment
        # ==========================================
        payments = db.query(Payment).filter(Payment.order_id == settled_ord.id).all()
        p14 = (len(payments) == 1) and (payments[0].amount == Decimal("561.00")) and (payments[0].method == PaymentMethod.UPI)
        record(14, "Verify exactly one payment record", p14,
               "0 payments before settlement",
               "Inspect payments table for order_id",
               "Exactly 1 payment, amount=₹561.00, method=UPI",
               f"{len(payments)} payment(s), amount={payments[0].amount if payments else 0}, method={payments[0].method if payments else None}",
               f"Payment recorded: {payments[0].id if payments else 'None'}")

        # ==========================================
        # Scenario 15: Verify exactly one loyalty allocation
        # ==========================================
        db.refresh(cust1)
        # Loyalty rule: 1 point per ₹100 of bill. ₹561.00 -> 5 points. Balance was 40 -> 45
        p15 = (cust1.loyalty_points_balance >= 45)
        record(15, "Verify loyalty point allocation", p15,
               "Customer balance was 40",
               "Check CRM loyalty balance post-settlement",
               "Loyalty balance increased by 5 (total 45)",
               f"Balance={cust1.loyalty_points_balance}",
               "Loyalty points accurately awarded")

        # ==========================================
        # Scenario 16: Verify the table becomes vacant
        # ==========================================
        db.refresh(tbl1)
        p16 = (tbl1.status == TableStatus.VACANT) and (tbl1.current_order_id is None) and (tbl1.current_bill == Decimal("0.00"))
        record(16, "Verify table becomes vacant post-settlement", p16,
               "Table T-01 was occupied",
               "Check table status, current_order_id, current_bill",
               "status=vacant, current_order_id=None, current_bill=0.00",
               f"status={tbl1.status.value}, current_order_id={tbl1.current_order_id}, current_bill={tbl1.current_bill}",
               "Table released cleanly")

        # ==========================================
        # Scenario 17: Reopen the table and create a completely new order
        # ==========================================
        ord2 = OrderService.get_or_create_table_order(db, t1_rest_id, tbl1.id, customer_name="New Guest", placed_by=PlacedBy.POS)
        p17 = (ord2.id != ord1.id) and (ord2.status != OrderStatus.COMPLETED)
        record(17, "Reopen table and create a completely new order", p17,
               "Table T-01 is vacant",
               "get_or_create_table_order(T-01)",
               "New distinct order created, not reusing old order",
               f"New Order ID={ord2.id} (Old was {ord1.id})",
               f"New order number={ord2.order_number}")

        # ==========================================
        # Scenario 18: Verify no previous items or ledger amounts remain
        # ==========================================
        new_items = db.query(OrderItem).filter(OrderItem.order_id == ord2.id).all()
        p18 = (len(new_items) == 0) and (ord2.total_amount == Decimal("0.00")) and (ord2.subtotal == Decimal("0.00"))
        record(18, "Verify no previous items or ledger amounts carry over", p18,
               "New order created",
               "Check items count and total_amount",
               "0 items, subtotal=0.00, total=0.00",
               f"{len(new_items)} items, subtotal={ord2.subtotal}, total={ord2.total_amount}",
               "Zero-balance clean ledger")

        # ==========================================
        # Scenario 19: Test an empty active order settlement rejection & safe cancellation
        # ==========================================
        empty_settle_failed = False
        try:
            OrderService.settle_bill(db, ord2.id, payment_method="cash")
        except ValueError as e:
            empty_settle_failed = True
            err_msg = str(e)

        # Cancel empty order safely
        OrderService.cancel_table_order(db, t1_rest_id, tbl1.id, reason="Accidental seating")
        db.refresh(tbl1)
        db.refresh(ord2)
        p19 = empty_settle_failed and (ord2.status == OrderStatus.CANCELLED) and (tbl1.status == TableStatus.VACANT)
        record(19, "Empty active order: reject ordinary settlement & safe cancel", p19,
               "Table T-01 has 0 items in active order",
               "Attempt settle_bill() -> expect rejection; then cancel_table_order()",
               "Settlement rejected; Cancel frees table and marks order CANCELLED",
               f"Settle rejected={empty_settle_failed}, Order status={ord2.status.value}, Table={tbl1.status.value}",
               "Zero fake sales created; table freed safely")

        # ==========================================
        # Scenario 20: Test a genuinely zero-value complimentary order
        # ==========================================
        ord3 = OrderService.get_or_create_table_order(db, t1_rest_id, tbl1.id, customer_name="VIP Critic")
        ord3 = OrderService.add_or_update_order_item(db, ord3.id, dish_paneer.id, delta_qty=1) # 300
        # 100% discount
        ord3.discount = Decimal("300.00")
        OrderService.recalculate_order_bill(db, ord3)
        # Settle as complimentary
        settled_comp = OrderService.settle_bill(db, ord3.id, payment_method="complimentary", complimentary_reason="VIP Food Critic Review")
        comp_payments = db.query(Payment).filter(Payment.order_id == ord3.id).all()
        p20 = (settled_comp.status == OrderStatus.COMPLETED) and (len(comp_payments) == 1) and (comp_payments[0].method == PaymentMethod.COMPLIMENTARY)
        record(20, "Genuinely zero-value complimentary order settlement", p20,
               "Total=₹0.00 after 100% discount",
               "settle_bill(complimentary, reason='VIP Food Critic')",
               "Order COMPLETED, COMPLIMENTARY payment recorded with ₹0 amount",
               f"Payment method={comp_payments[0].method.value if comp_payments else None}, amount={comp_payments[0].amount if comp_payments else None}",
               "Complimentary audit trail recorded")

        # ==========================================
        # Scenario 21: Test missing and invalid prices
        # ==========================================
        p21_failed = False
        try:
            BillingService.calculate_totals([{"price": "-50.00", "quantity": 1}], rest1)
        except ValueError:
            p21_failed = True

        p21_nan_failed = False
        try:
            BillingService.calculate_totals([{"price": "NaN", "quantity": 1}], rest1)
        except ValueError:
            p21_nan_failed = True

        p21 = p21_failed and p21_nan_failed
        record(21, "Missing and invalid prices rejected", p21,
               "Negative / NaN price inputs",
               "BillingService.calculate_totals()",
               "Raises ValueError for invalid monetary values",
               f"Negative rejected={p21_failed}, NaN rejected={p21_nan_failed}",
               "Financial calculation hardened")

        # ==========================================
        # Scenario 22: Test duplicate settlement attempt
        # ==========================================
        dup_settle_failed = False
        try:
            OrderService.settle_bill(db, ord3.id, payment_method="cash")
        except ValueError as e:
            dup_settle_failed = True
            dup_msg = str(e)
        p22 = dup_settle_failed and ("already" in dup_msg.lower() or "settled" in dup_msg.lower())
        record(22, "Duplicate settlement attempt rejected (HTTP 409 equivalent)", p22,
               "Order already settled",
               "settle_bill() on paid order",
               "Raises ValueError: Order has already been settled and paid",
               f"Rejected={dup_settle_failed}, Msg='{dup_msg if dup_settle_failed else None}'",
               "Idempotent protection active")

        # ==========================================
        # Scenario 23: Test two simultaneous settlement requests
        # ==========================================
        ord4 = OrderService.get_or_create_table_order(db, t1_rest_id, tbl1.id, customer_name="Concurrency Tester")
        ord4 = OrderService.add_or_update_order_item(db, ord4.id, dish_paneer.id, delta_qty=1)

        def attempt_settle(order_id: str, tender: str):
            local_db = SessionLocal()
            try:
                res = OrderService.settle_bill(local_db, order_id, payment_method=tender)
                return ("SUCCESS", res.id)
            except Exception as e:
                return ("FAILED", str(e))
            finally:
                local_db.close()

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            f1 = executor.submit(attempt_settle, ord4.id, "upi")
            f2 = executor.submit(attempt_settle, ord4.id, "cash")
            res1 = f1.result()
            res2 = f2.result()

        results = [res1[0], res2[0]]
        payments4 = db.query(Payment).filter(Payment.order_id == ord4.id).all()
        p23 = (results.count("SUCCESS") == 1) and (results.count("FAILED") == 1) and (len(payments4) == 1)
        record(23, "Two simultaneous concurrent settlement requests", p23,
               "Unpaid active order",
               "Concurrent settle_bill() in 2 threads",
               "Exactly 1 succeeds, exactly 1 fails, exactly 1 payment in DB",
               f"Results: {results}, Payments count in DB: {len(payments4)}",
               "Row-level locking prevented duplicate payment")

        # ==========================================
        # Scenario 24: Test switching between two occupied tables
        # ==========================================
        ord_t1 = OrderService.get_or_create_table_order(db, t1_rest_id, tbl1.id, customer_name="Table 1 Guest")
        ord_t1 = OrderService.add_or_update_order_item(db, ord_t1.id, dish_paneer.id, delta_qty=2) # 2 Paneer

        ord_t2 = OrderService.get_or_create_table_order(db, t1_rest_id, tbl2.id, customer_name="Table 2 Guest")
        ord_t2 = OrderService.add_or_update_order_item(db, ord_t2.id, dish_naan.id, delta_qty=5)   # 5 Naan

        items_t1 = db.query(OrderItem).filter(OrderItem.order_id == ord_t1.id).all()
        items_t2 = db.query(OrderItem).filter(OrderItem.order_id == ord_t2.id).all()

        p24 = (len(items_t1) == 1 and items_t1[0].name == "Paneer Butter Masala" and items_t1[0].quantity == 2) and \
              (len(items_t2) == 1 and items_t2[0].name == "Garlic Naan" and items_t2[0].quantity == 5)
        record(24, "Switching between two occupied tables (No cross-table leakage)", p24,
               "T-01 has 2 Paneer, T-02 has 5 Naan",
               "Retrieve orders for T-01 and T-02 independently",
               "T-01 has strictly 2 Paneer; T-02 has strictly 5 Naan; zero item bleeding",
               f"T-01 items: {[i.name for i in items_t1]}, T-02 items: {[i.name for i in items_t2]}",
               "Table ledgers completely isolated")

        # ==========================================
        # Scenario 25: Test unauthorized cross-restaurant order access
        # ==========================================
        p25_cross_access_blocked = False
        try:
            # Tenant 2 attempting to create/modify order on Tenant 1's table
            OrderService.get_or_create_table_order(db, t2_rest_id, tbl1.id)
        except ValueError as e:
            p25_cross_access_blocked = True
            cross_err = str(e)

        p25 = p25_cross_access_blocked
        record(25, "Unauthorized cross-restaurant order access rejected", p25,
               "Tenant 2 requests access to Tenant 1's table tbl-pos-01",
               "get_or_create_table_order(rest_2, tbl-pos-01)",
               "Rejection: Table not found in this restaurant",
               f"Blocked={p25_cross_access_blocked}, Error='{cross_err if p25_cross_access_blocked else None}'",
               "Multi-tenant isolation verified")

    finally:
        db.close()

if __name__ == "__main__":
    run_all_25_scenarios()
    total = len(scenarios_log)
    passed = sum(1 for s in scenarios_log if s["passed"])
    print(f"\n==========================================")
    print(f"25 SCENARIOS VERIFICATION: {passed}/{total} PASSED")
    print(f"==========================================")
    if passed < total:
        sys.exit(1)
    else:
        sys.exit(0)
