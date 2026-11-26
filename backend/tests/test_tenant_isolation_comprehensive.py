import pytest
from decimal import Decimal
from datetime import datetime, timezone
from app.models.restaurant import Restaurant
from app.models.user import User
from app.models.table import DiningTable, TableStatus
from app.models.menu import MenuCategory, MenuItem, DietaryType, StationType
from app.models.order import Order, OrderItem, OrderStatus, PaymentStatus, OrderMode, PlacedBy
from app.models.customer import Customer
from app.models.inventory import Ingredient
from app.services.ai_service import AIService
from app.core.security import create_access_token
from app.core.permissions import UserRole

@pytest.fixture
def two_qa_tenants(db_session):
    """Fixture creating two strictly separated QA restaurants with distinct datasets."""
    # Restaurant Alpha
    rest_a = Restaurant(
        id="rest-qa-alpha",
        name="Alpha Bistro",
        code="ALPHA",
        address="123 Alpha St, Bandra, Mumbai",
        city="Mumbai",
        phone="+919800000001",
        currency="INR"
    )
    # Restaurant Beta
    rest_b = Restaurant(
        id="rest-qa-beta",
        name="Beta Diner",
        code="BETA",
        address="456 Beta Rd, Colaba, Mumbai",
        city="Mumbai",
        phone="+919800000002",
        currency="INR"
    )
    db_session.add_all([rest_a, rest_b])
    db_session.flush()

    # Users
    user_a = User(
        id="user-qa-alpha-mgr",
        restaurant_id=rest_a.id,
        email="mgr@alpha.test",
        full_name="Alpha Manager",
        hashed_password="hashed_pwd",
        role=UserRole.MANAGER,
        is_active=True
    )
    user_b = User(
        id="user-qa-beta-mgr",
        restaurant_id=rest_b.id,
        email="mgr@beta.test",
        full_name="Beta Manager",
        hashed_password="hashed_pwd",
        role=UserRole.MANAGER,
        is_active=True
    )
    db_session.add_all([user_a, user_b])

    # Tables
    tbl_a = DiningTable(
        id="tbl-alpha-1",
        restaurant_id=rest_a.id,
        label="Table A1",
        capacity=4,
        status=TableStatus.OCCUPIED,
        qr_token="qr-alpha-1"
    )
    tbl_b = DiningTable(
        id="tbl-beta-1",
        restaurant_id=rest_b.id,
        label="Table B1",
        capacity=2,
        status=TableStatus.VACANT,
        qr_token="qr-beta-1"
    )
    db_session.add_all([tbl_a, tbl_b])

    # Menu Categories & Items
    cat_a = MenuCategory(id="cat-alpha-1", restaurant_id=rest_a.id, name="Alpha Specials", slug="alpha-specials", display_order=1)
    cat_b = MenuCategory(id="cat-beta-1", restaurant_id=rest_b.id, name="Beta Delights", slug="beta-delights", display_order=1)
    db_session.add_all([cat_a, cat_b])
    db_session.flush()

    dish_a = MenuItem(
        id="dish-alpha-paneer",
        restaurant_id=rest_a.id,
        category_id=cat_a.id,
        name="Alpha Paneer",
        price=Decimal("350.00"),
        is_active=True,
        is_in_stock=True
    )
    dish_b = MenuItem(
        id="dish-beta-biryani",
        restaurant_id=rest_b.id,
        category_id=cat_b.id,
        name="Beta Biryani",
        price=Decimal("450.00"),
        is_active=True,
        is_in_stock=True
    )
    db_session.add_all([dish_a, dish_b])

    # Orders & OrderItems
    now = datetime.now(timezone.utc)
    order_a = Order(
        id="ord-alpha-101",
        order_number="A-101",
        token_number="T-101",
        restaurant_id=rest_a.id,
        table_id=tbl_a.id,
        mode=OrderMode.DINE_IN,
        status=OrderStatus.COMPLETED,
        payment_status=PaymentStatus.PAID,
        total_amount=Decimal("1500.00"),
        placed_by=PlacedBy.POS,
        created_at=now
    )
    order_b = Order(
        id="ord-beta-201",
        order_number="B-201",
        token_number="T-201",
        restaurant_id=rest_b.id,
        table_id=tbl_b.id,
        mode=OrderMode.DINE_IN,
        status=OrderStatus.COMPLETED,
        payment_status=PaymentStatus.PAID,
        total_amount=Decimal("4500.00"),
        placed_by=PlacedBy.POS,
        created_at=now
    )
    db_session.add_all([order_a, order_b])
    db_session.flush()

    oi_a = OrderItem(
        id="oi-alpha-1",
        order_id=order_a.id,
        menu_item_id=dish_a.id,
        name="Alpha Paneer",
        quantity=3,
        price=Decimal("350.00"),
        created_at=now
    )
    oi_b = OrderItem(
        id="oi-beta-1",
        order_id=order_b.id,
        menu_item_id=dish_b.id,
        name="Beta Biryani",
        quantity=10,
        price=Decimal("450.00"),
        created_at=now
    )
    db_session.add_all([oi_a, oi_b])

    # Customers
    cust_a = Customer(
        id="cust-alpha-1",
        restaurant_id=rest_a.id,
        name="Alice Alpha",
        phone="+919999900001",
        total_orders=5
    )
    cust_b = Customer(
        id="cust-beta-1",
        restaurant_id=rest_b.id,
        name="Bob Beta",
        phone="+919999900002",
        total_orders=15
    )
    db_session.add_all([cust_a, cust_b])

    # Ingredients
    ing_a = Ingredient(
        id="ing-alpha-1",
        restaurant_id=rest_a.id,
        name="Alpha Butter",
        current_stock=Decimal("1.50"),
        reorder_threshold=Decimal("5.00"),
        cost_per_unit=Decimal("200.00"),
        unit="kg"
    )
    ing_b = Ingredient(
        id="ing-beta-1",
        restaurant_id=rest_b.id,
        name="Beta Saffron",
        current_stock=Decimal("0.20"),
        reorder_threshold=Decimal("1.00"),
        cost_per_unit=Decimal("1500.00"),
        unit="g"
    )
    db_session.add_all([ing_a, ing_b])

    db_session.commit()
    return {"rest_a": rest_a, "rest_b": rest_b, "user_a": user_a, "user_b": user_b, "dish_a": dish_a, "dish_b": dish_b, "order_a": order_a, "order_b": order_b}

@pytest.mark.asyncio
async def test_chotu_ai_tenant_isolation(db_session, two_qa_tenants):
    """Verify Chotu AI queries NEVER leak records across tenants."""
    rest_a_id = two_qa_tenants["rest_a"].id
    rest_b_id = two_qa_tenants["rest_b"].id

    # 1. Sales Query for Restaurant Alpha
    r_sales_a = await AIService.chat(db_session, rest_a_id, "How much did we earn today?")
    assert "1,500.00" in r_sales_a.reply or "1500" in r_sales_a.reply
    assert "4,500" not in r_sales_a.reply, "CRITICAL LEAK: Alpha saw Beta sales!"

    # 2. Sales Query for Restaurant Beta
    r_sales_b = await AIService.chat(db_session, rest_b_id, "How much did we earn today?")
    assert "4,500.00" in r_sales_b.reply or "4500" in r_sales_b.reply
    assert "1,500" not in r_sales_b.reply, "CRITICAL LEAK: Beta saw Alpha sales!"

    # 3. Top Dishes for Restaurant Alpha
    r_dish_a = await AIService.chat(db_session, rest_a_id, "Which dishes sold the most this week?")
    assert "Alpha Paneer" in r_dish_a.reply
    assert "Beta Biryani" not in r_dish_a.reply, "CRITICAL LEAK: Alpha saw Beta top dish!"

    # 4. Top Dishes for Restaurant Beta
    r_dish_b = await AIService.chat(db_session, rest_b_id, "Which dishes sold the most this week?")
    assert "Beta Biryani" in r_dish_b.reply
    assert "Alpha Paneer" not in r_dish_b.reply, "CRITICAL LEAK: Beta saw Alpha top dish!"

    # 5. Low Stock for Restaurant Alpha
    r_inv_a = await AIService.chat(db_session, rest_a_id, "Which ingredients are running low?")
    assert "Alpha Butter" in r_inv_a.reply
    assert "Beta Saffron" not in r_inv_a.reply, "CRITICAL LEAK: Alpha saw Beta inventory!"

    # 6. Customer CRM for Restaurant Alpha
    r_cust_a = await AIService.chat(db_session, rest_a_id, "Which customers visited most frequently?")
    assert "Alice Alpha" in r_cust_a.reply
    assert "Bob Beta" not in r_cust_a.reply, "CRITICAL LEAK: Alpha saw Beta customer!"

    # 7. Tables for Restaurant Alpha
    r_tbl_a = await AIService.chat(db_session, rest_a_id, "Which tables are currently occupied?")
    assert "Table A1" in r_tbl_a.reply
    assert "Table B1" not in r_tbl_a.reply, "CRITICAL LEAK: Alpha saw Beta table!"

def test_api_tenant_isolation_and_idor(client, db_session, two_qa_tenants):
    """Verify REST API endpoints prevent cross-tenant data leakage and IDOR attacks."""
    user_a = two_qa_tenants["user_a"]
    order_b = two_qa_tenants["order_b"]
    dish_b = two_qa_tenants["dish_b"]

    token_a = create_access_token(
        subject=user_a.id,
        extra_claims={"role": user_a.role.value, "restaurant_id": user_a.restaurant_id}
    )
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 1. Menu Items list must only contain Alpha dishes
    resp_menu = client.get("/api/v1/menu/items", headers=headers_a)
    assert resp_menu.status_code == 200
    menu_items = resp_menu.json()
    item_names = [i["name"] for i in menu_items]
    assert "Alpha Paneer" in item_names
    assert "Beta Biryani" not in item_names, "CRITICAL IDOR: Alpha fetched Beta menu items!"

    # 2. Orders list must only contain Alpha orders
    resp_orders = client.get("/api/v1/orders", headers=headers_a)
    assert resp_orders.status_code == 200
    orders = resp_orders.json()
    order_ids = [o["id"] for o in orders]
    assert "ord-alpha-101" in order_ids
    assert "ord-beta-201" not in order_ids, "CRITICAL IDOR: Alpha fetched Beta orders!"

    # 3. Direct IDOR attempt: Alpha tries to GET Beta order by ID
    resp_idor_get = client.get(f"/api/v1/orders/{order_b.id}", headers=headers_a)
    assert resp_idor_get.status_code in [404, 403], f"CRITICAL IDOR: Alpha read Beta order! Got {resp_idor_get.status_code}"

    # 4. Direct IDOR attempt: Alpha tries to cancel Beta order
    resp_idor_cancel = client.post(f"/api/v1/orders/{order_b.id}/cancel", headers=headers_a)
    assert resp_idor_cancel.status_code in [404, 403], f"CRITICAL IDOR: Alpha cancelled Beta order! Got {resp_idor_cancel.status_code}"

    # 5. Direct IDOR attempt: Alpha tries to modify Beta dish
    resp_idor_dish = client.patch(f"/api/v1/menu/items/{dish_b.id}", json={"price": 10.0}, headers=headers_a)
    assert resp_idor_dish.status_code in [404, 403], f"CRITICAL IDOR: Alpha updated Beta dish! Got {resp_idor_dish.status_code}"
