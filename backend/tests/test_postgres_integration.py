import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database.session import get_db
from app.models import Restaurant, User, DiningTable, Order, KOT, Ingredient, AIConversation

from app.core.security import create_access_token

# Dedicated PostgreSQL Test Database (guarantees production/dev DB is untouched)
TEST_DATABASE_URL = "postgresql+psycopg://postgres:postgres@127.0.0.1:5432/chotu_test"
test_engine = create_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(scope="module")
def pg_client():
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()
            
    app.dependency_overrides[get_db] = override_get_db
    token = create_access_token(
        subject="user-mgr-01",
        extra_claims={"role": "manager", "restaurant_id": "rest-spice-jct"}
    )
    with TestClient(app, headers={"Authorization": f"Bearer {token}"}) as client:
        yield client
    app.dependency_overrides.clear()

def test_01_postgresql_database_connection():
    """Verify live PostgreSQL operational database connection and tables."""
    db = TestingSessionLocal()
    try:
        restaurant = db.query(Restaurant).first()
        assert restaurant is not None
        assert restaurant.code == "SPICE-JCT"
        assert restaurant.currency == "INR"
    finally:
        db.close()

def test_02_integration_auth_login(pg_client):
    """Integration Test: Auth login against PostgreSQL users table."""
    response = pg_client.post(
        "/api/v1/auth/login",
        json={"email": "manager@spicejunction.in", "password": "Chotu@123"}
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "manager"
    assert data["restaurant_id"] == "rest-spice-jct"

def test_03_integration_dining_tables(pg_client):
    """Integration Test: Fetch dining tables from PostgreSQL."""
    response = pg_client.get("/api/v1/tables")
    assert response.status_code == 200
    tables = response.json()
    assert len(tables) >= 8
    table_labels = [t["label"] for t in tables]
    assert "T-01" in table_labels
    assert "T-04" in table_labels

def test_04_integration_menu_catalog(pg_client):
    """Integration Test: Fetch menu categories and items from PostgreSQL."""
    response = pg_client.get("/api/v1/menu/items")
    assert response.status_code == 200
    items = response.json()
    assert len(items) >= 10
    dish_names = [item["name"] for item in items]
    assert any("Butter Chicken" in d for d in dish_names)
    assert any("Paneer Tikka" in d for d in dish_names)

def test_05_integration_pos_table_order(pg_client):
    """Integration Test: Fetch active table order from PostgreSQL."""
    response = pg_client.get("/api/v1/pos/tables/T-04/order")
    assert response.status_code == 200
    order_data = response.json()
    assert order_data["table_id"] == "T-04"
    assert len(order_data["items"]) >= 1

def test_06_integration_kds_kots(pg_client):
    """Integration Test: Kitchen Display System against PostgreSQL."""
    response = pg_client.get("/api/v1/kds/tickets?status=active")
    assert response.status_code == 200
    tickets = response.json()
    assert len(tickets) >= 1
    assert any(t["table_id"] == "T-04" for t in tickets)

def test_07_integration_qr_ordering(pg_client):
    """Integration Test: QR table ordering endpoint against PostgreSQL."""
    response = pg_client.get("/api/v1/qr/qr-t04-demo/menu")
    assert response.status_code == 200
    data = response.json()
    assert data["table_label"] == "T-04"
    assert len(data["items"]) >= 10

def test_08_integration_inventory_management(pg_client):
    """Integration Test: Inventory items and alerts from PostgreSQL."""
    response = pg_client.get("/api/v1/inventory/ingredients")
    assert response.status_code == 200
    ingredients = response.json()
    assert len(ingredients) >= 7
    ing_names = [i["name"] for i in ingredients]
    assert any("Paneer" in n for n in ing_names)
    assert any("Chicken" in n for n in ing_names)

def test_09_integration_analytics_dashboard(pg_client):
    """Integration Test: Operational Analytics calculated from PostgreSQL."""
    response = pg_client.get("/api/v1/analytics/overview")
    assert response.status_code == 200
    data = response.json()
    assert "today_revenue" in data
    assert "channel_sales" in data
    assert len(data["channel_sales"]) == 3
    assert "weekly_traffic" in data
    assert len(data["weekly_traffic"]) == 7

def test_10_integration_ai_conversation_persistence(pg_client):
    """Integration Test: AI chat query processed and verified."""
    response = pg_client.post(
        "/api/v1/ai/chat",
        json={"message": "What are today's sales?"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert data["intent"] == "QUERY_SALES"
