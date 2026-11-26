import pytest
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from app.models.restaurant import Restaurant
from app.models.order import Order, OrderMode, OrderStatus, PaymentStatus, PlacedBy
from app.models.customer import Customer, LoyaltyTxType
from app.services.analytics_service import AnalyticsService
from app.services.crm_service import CRMService

def test_analytics_revenue_and_timezone_reconciliation(db_session: Session):
    rest = Restaurant(
        id="rest-analytics-test",
        name="Analytics Test Restro",
        code="ANALYTICS1",
        address="103 Test Road",
        phone="+919876543212",
        currency="INR"
    )
    db_session.add(rest)

    ist = ZoneInfo("Asia/Kolkata")
    now_ist = datetime.now(timezone.utc).astimezone(ist)
    today_utc = now_ist.astimezone(timezone.utc).replace(tzinfo=None)

    # 1. Paid completed order today (Should be included)
    order_paid = Order(
        id="ord-rev-001",
        restaurant_id=rest.id,
        order_number="REV-1",
        token_number="TK-1",
        customer_name="Pooja",
        customer_phone="+919800011111",
        mode=OrderMode.DINE_IN,
        status=OrderStatus.COMPLETED,
        payment_status=PaymentStatus.PAID,
        placed_by=PlacedBy.POS,
        subtotal=Decimal("1000.00"),
        total_amount=Decimal("1050.00"),
        created_at=today_utc
    )
    db_session.add(order_paid)

    # 2. Unpaid order today (MUST BE EXCLUDED from revenue)
    order_unpaid = Order(
        id="ord-rev-002",
        restaurant_id=rest.id,
        order_number="REV-2",
        token_number="TK-2",
        customer_name="Rahul",
        customer_phone="+919800022222",
        mode=OrderMode.DINE_IN,
        status=OrderStatus.PREPARING,
        payment_status=PaymentStatus.PENDING,
        placed_by=PlacedBy.POS,
        subtotal=Decimal("500.00"),
        total_amount=Decimal("525.00"),
        created_at=today_utc
    )
    db_session.add(order_unpaid)

    # 3. Cancelled order today (MUST BE EXCLUDED from revenue)
    order_cancelled = Order(
        id="ord-rev-003",
        restaurant_id=rest.id,
        order_number="REV-3",
        token_number="TK-3",
        customer_name="Ananya",
        customer_phone="+919800033333",
        mode=OrderMode.DELIVERY,
        status=OrderStatus.CANCELLED,
        payment_status=PaymentStatus.PAID,  # Even if marked paid, cancellation voids revenue
        placed_by=PlacedBy.POS,
        subtotal=Decimal("700.00"),
        total_amount=Decimal("735.00"),
        created_at=today_utc
    )
    db_session.add(order_cancelled)

    # 4. Order from 10 days ago (MUST BE EXCLUDED from "today" overview)
    order_old = Order(
        id="ord-rev-004",
        restaurant_id=rest.id,
        order_number="REV-4",
        token_number="TK-4",
        customer_name="Old Order",
        mode=OrderMode.DINE_IN,
        status=OrderStatus.COMPLETED,
        payment_status=PaymentStatus.PAID,
        placed_by=PlacedBy.POS,
        subtotal=Decimal("2000.00"),
        total_amount=Decimal("2100.00"),
        created_at=today_utc - timedelta(days=10)
    )
    db_session.add(order_old)
    db_session.commit()

    # Query overview for "today"
    overview = AnalyticsService.get_overview(db_session, rest.id, period="today")
    
    # Revenue should ONLY be 1050.00 from ord-rev-001
    assert overview.today_revenue == Decimal("1050.00")
    assert overview.completed_orders_today == 1

def test_loyalty_reconciliation_and_idempotency(db_session: Session):
    rest = Restaurant(
        id="rest-loyalty-test",
        name="Loyalty Test Restro",
        code="LOYALTY1",
        address="104 Test Road",
        phone="+919876543213",
        currency="INR"
    )
    db_session.add(rest)

    customer = Customer(
        id="cust-loy-001",
        restaurant_id=rest.id,
        name="Amit Patel",
        phone="+919876500000",
        loyalty_points_balance=0,
        total_orders=0,
        total_spend=Decimal("0.00")
    )
    db_session.add(customer)
    db_session.commit()

    order = Order(
        id="ord-loy-001",
        restaurant_id=rest.id,
        order_number="LOY-1",
        token_number="TK-LOY-1",
        customer_name=customer.name,
        customer_phone=customer.phone,
        mode=OrderMode.DINE_IN,
        status=OrderStatus.COMPLETED,
        payment_status=PaymentStatus.PAID,
        placed_by=PlacedBy.POS,
        subtotal=Decimal("600.00"),  # 6 * 5 = 30 points
        total_amount=Decimal("630.00")
    )
    db_session.add(order)
    db_session.commit()

    # 1. Award points for order
    tx1 = CRMService.award_points_for_order(db_session, order)
    assert tx1 is not None
    assert tx1.points == 30
    assert customer.loyalty_points_balance == 30
    assert customer.total_orders == 1
    assert customer.total_spend == Decimal("630.00")

    # 2. Duplicate award attempt MUST BE IDEMPOTENT (no double crediting)
    tx_dup = CRMService.award_points_for_order(db_session, order)
    assert tx_dup.id == tx1.id
    assert customer.loyalty_points_balance == 30

    # 3. Manual adjustment with idempotency key
    idemp_key = "manual-adj-bonus-100"
    tx_adj1 = CRMService.adjust_points(
        db_session,
        customer_id=customer.id,
        restaurant_id=rest.id,
        tx_type=LoyaltyTxType.ADJUSTMENT,
        points=50,
        notes="Festive bonus",
        idempotency_key=idemp_key
    )
    assert tx_adj1.points == 50
    assert customer.loyalty_points_balance == 80

    # 4. Duplicate manual adjustment with same idempotency key is rejected
    tx_adj_dup = CRMService.adjust_points(
        db_session,
        customer_id=customer.id,
        restaurant_id=rest.id,
        tx_type=LoyaltyTxType.ADJUSTMENT,
        points=50,
        notes="Festive bonus",
        idempotency_key=idemp_key
    )
    assert tx_adj_dup.id == tx_adj1.id
    assert customer.loyalty_points_balance == 80  # Still 80, not 130
