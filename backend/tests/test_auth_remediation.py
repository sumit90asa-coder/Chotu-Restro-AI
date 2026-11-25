from datetime import timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database.session import get_db
from app.models.user import User
from app.models.restaurant import Restaurant
from app.models.table import DiningTable
from app.core.security import create_access_token, get_password_hash
from app.core.permissions import UserRole

# Isolated PostgreSQL Test Database connection
TEST_DATABASE_URL = "postgresql+psycopg://postgres:postgres@127.0.0.1:5432/chotu_test"
test_engine = create_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(scope="module")
def pg_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="module")
def unauthed_client():
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()

@pytest.fixture(scope="module")
def owner_token(pg_session):
    owner = pg_session.query(User).filter(User.role == UserRole.OWNER).first()
    token = create_access_token(
        subject=owner.id,
        extra_claims={"role": owner.role.value, "restaurant_id": owner.restaurant_id}
    )
    return token

@pytest.fixture(scope="module")
def manager_token(pg_session):
    manager = pg_session.query(User).filter(User.role == UserRole.MANAGER).first()
    token = create_access_token(
        subject=manager.id,
        extra_claims={"role": manager.role.value, "restaurant_id": manager.restaurant_id}
    )
    return token

@pytest.fixture(scope="module")
def waiter_token(pg_session):
    waiter = pg_session.query(User).filter(User.role == UserRole.WAITER).first()
    token = create_access_token(
        subject=waiter.id,
        extra_claims={"role": waiter.role.value, "restaurant_id": waiter.restaurant_id}
    )
    return token


# ==============================================================================
# PHASE F — 14 REQUIRED AUTOMATED SECURITY & AUTHENTICATION REMEDIATION TESTS
# ==============================================================================

def test_01_no_authorization_token_returns_401(unauthed_client):
    """1. No authorization token -> HTTP 401 on all protected endpoints."""
    resp_me = unauthed_client.get("/api/v1/auth/me")
    assert resp_me.status_code == 401, f"Expected 401, got {resp_me.status_code}"

    resp_orders = unauthed_client.get("/api/v1/orders")
    assert resp_orders.status_code == 401, f"Expected 401, got {resp_orders.status_code}"

    resp_tables = unauthed_client.get("/api/v1/tables")
    assert resp_tables.status_code == 401, f"Expected 401, got {resp_tables.status_code}"


def test_02_invalid_token_returns_401(unauthed_client):
    """2. Invalid token -> HTTP 401."""
    # Gibberish string
    headers = {"Authorization": "Bearer not_a_valid_jwt_token_12345"}
    resp = unauthed_client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 401

    # Insecure demo token must be strictly rejected
    headers_demo = {"Authorization": "Bearer demo-token"}
    resp_demo = unauthed_client.get("/api/v1/auth/me", headers=headers_demo)
    assert resp_demo.status_code == 401


def test_03_expired_token_returns_401(unauthed_client, pg_session):
    """3. Expired token -> HTTP 401."""
    owner = pg_session.query(User).filter(User.role == UserRole.OWNER).first()
    # Generate token that expired 1 hour ago
    expired_token = create_access_token(
        subject=owner.id,
        expires_delta=timedelta(hours=-1),
        extra_claims={"role": owner.role.value, "restaurant_id": owner.restaurant_id}
    )
    headers = {"Authorization": f"Bearer {expired_token}"}
    resp = unauthed_client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 401


def test_04_tampered_token_returns_401(unauthed_client, owner_token):
    """4. Tampered token -> HTTP 401."""
    # Flip characters in the signature segment
    parts = owner_token.split(".")
    tampered_sig = parts[2][:-5] + ("AAAAA" if not parts[2].endswith("AAAAA") else "BBBBB")
    tampered_token = f"{parts[0]}.{parts[1]}.{tampered_sig}"
    
    headers = {"Authorization": f"Bearer {tampered_token}"}
    resp = unauthed_client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 401


def test_05_inactive_user_returns_401(unauthed_client, pg_session):
    """5. Inactive user -> HTTP 401."""
    # Find or create an inactive user in PostgreSQL
    inactive_user = pg_session.query(User).filter(User.is_active == False).first()
    if not inactive_user:
        inactive_user = User(
            id="user-inactive-test",
            restaurant_id="rest-spice-jct",
            email="inactive_staff@spicejunction.in",
            full_name="Deactivated Staff",
            hashed_password=get_password_hash("Chotu@123"),
            role=UserRole.CASHIER,
            is_active=False
        )
        pg_session.add(inactive_user)
        pg_session.commit()
        pg_session.refresh(inactive_user)

    # A) Attempt login with inactive user credentials -> must be rejected
    login_resp = unauthed_client.post(
        "/api/v1/auth/login",
        json={"email": inactive_user.email, "password": "Chotu@123"}
    )
    assert login_resp.status_code == 401

    # B) Calling API with token generated for inactive user -> must be rejected
    token = create_access_token(
        subject=inactive_user.id,
        extra_claims={"role": inactive_user.role.value, "restaurant_id": inactive_user.restaurant_id}
    )
    resp = unauthed_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


def test_06_valid_owner_login_success(unauthed_client):
    """6. Valid owner login -> success with scoped JWT."""
    resp = unauthed_client.post(
        "/api/v1/auth/login",
        json={"email": "owner@spicejunction.in", "password": "Chotu@123"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["role"] == "owner"
    assert data["restaurant_id"] == "rest-spice-jct"

    # Verify user profile retrieval
    me_resp = unauthed_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {data['access_token']}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "owner@spicejunction.in"


def test_07_valid_manager_login_success(unauthed_client):
    """7. Valid manager login -> success with scoped JWT."""
    resp = unauthed_client.post(
        "/api/v1/auth/login",
        json={"email": "manager@spicejunction.in", "password": "Chotu@123"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["role"] == "manager"
    assert data["restaurant_id"] == "rest-spice-jct"


def test_08_unauthorized_role_action_returns_403(unauthed_client, waiter_token):
    """8. Unauthorized role action -> HTTP 403."""
    # Waiter cannot update restaurant settings (requires settings:update permission)
    headers = {"Authorization": f"Bearer {waiter_token}"}
    resp = unauthed_client.patch(
        "/api/v1/settings",
        json={"name": "Hacked Restaurant Name"},
        headers=headers
    )
    assert resp.status_code == 403


def test_09_cross_restaurant_access_rejected(unauthed_client, pg_session):
    """9. Cross-restaurant access -> rejected (tenant isolation)."""
    # Create an independent second restaurant and owner
    other_rest = pg_session.query(Restaurant).filter(Restaurant.id == "rest-tenant-b").first()
    if not other_rest:
        other_rest = Restaurant(
            id="rest-tenant-b",
            name="Tenant B Bistro",
            code="TENANT-B",
            address="Koramangala, Bengaluru",
            city="Bengaluru",
            phone="+91 98800 11223",
            currency="INR"
        )
        pg_session.add(other_rest)
        pg_session.commit()

    other_user = pg_session.query(User).filter(User.id == "user-tenant-b-mgr").first()
    if not other_user:
        other_user = User(
            id="user-tenant-b-mgr",
            restaurant_id="rest-tenant-b",
            email="manager@tenantb.com",
            full_name="Tenant B Manager",
            hashed_password=get_password_hash("TenantB@123"),
            role=UserRole.MANAGER,
            is_active=True
        )
        pg_session.add(other_user)
        pg_session.commit()

    token_b = create_access_token(
        subject=other_user.id,
        extra_claims={"role": other_user.role.value, "restaurant_id": other_user.restaurant_id}
    )
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Tenant B tries to query Tenant A's table T-01
    resp = unauthed_client.get("/api/v1/tables/T-01", headers=headers_b)
    # Filter scopes to restaurant_id == current_user.restaurant_id; table not found in tenant B
    assert resp.status_code == 404


def test_10_logout_clears_session(unauthed_client, manager_token):
    """10. Logout invalidates or clears the session correctly."""
    headers = {"Authorization": f"Bearer {manager_token}"}
    resp = unauthed_client.post("/api/v1/auth/logout", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "logged_out"


def test_11_refresh_authenticated_dashboard_preserves_session(unauthed_client, manager_token):
    """11. Refreshing an authenticated dashboard preserves a valid session."""
    headers = {"Authorization": f"Bearer {manager_token}"}
    for _ in range(3):
        resp = unauthed_client.get("/api/v1/auth/me", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["role"] == "manager"


def test_12_direct_unauthenticated_dashboard_access_fails(unauthed_client):
    """12. Direct unauthenticated dashboard access fails at API layer."""
    # Protected backend dashboard dependencies fail with 401
    resp = unauthed_client.get("/api/v1/tables")
    assert resp.status_code == 401
    resp_analytics = unauthed_client.get("/api/v1/analytics/overview")
    assert resp_analytics.status_code == 401


def test_13_public_landing_and_qr_remain_accessible(unauthed_client):
    """13. Public landing, health checks, and QR menus remain accessible without auth."""
    # Health checks
    assert unauthed_client.get("/health").status_code == 200
    assert unauthed_client.get("/api/v1/health").status_code == 200

    # Public QR table and menu endpoints
    resp_qr_table = unauthed_client.get("/api/v1/qr/qr-t04-demo/table")
    assert resp_qr_table.status_code == 200
    assert resp_qr_table.json()["table_label"] == "T-04"

    resp_qr_menu = unauthed_client.get("/api/v1/qr/qr-t04-demo/menu")
    assert resp_qr_menu.status_code == 200
    assert len(resp_qr_menu.json()["items"]) >= 1


def test_14_existing_pos_qr_kds_operational_for_authenticated_users(unauthed_client, manager_token):
    """14. Existing POS, QR and KDS workflows remain fully operational for authenticated users."""
    headers = {"Authorization": f"Bearer {manager_token}"}

    # 1. Fetch tables
    resp_tables = unauthed_client.get("/api/v1/tables", headers=headers)
    assert resp_tables.status_code == 200
    assert len(resp_tables.json()) >= 1

    # 2. Fetch KDS tickets
    resp_kds = unauthed_client.get("/api/v1/kds/tickets", headers=headers)
    assert resp_kds.status_code == 200

    # 3. Customer submits QR order (public workflow)
    qr_order_payload = {
        "customer_name": "Test Guest",
        "items": [{"dish_id": "dish-01", "name": "Butter Chicken (Boneless)", "price": 340.00, "quantity": 1}],
        "captain_notes": "Allergic to nuts",
        "table_id": "T-04"
    }
    resp_qr = unauthed_client.post("/api/v1/qr/qr-t04-demo/orders", json=qr_order_payload)
    assert resp_qr.status_code == 200

    # 4. Authenticated staff fetches orders
    resp_orders = unauthed_client.get("/api/v1/orders", headers=headers)
    assert resp_orders.status_code == 200
