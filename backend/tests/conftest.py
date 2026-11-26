import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from contextlib import asynccontextmanager
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.database.session import Base, get_db
from app.initial_data import init_demo_db
from app.core.security import get_password_hash, create_access_token, clear_revoked_tokens
from app.models.user import User
from app.core.permissions import UserRole

# Precompute password hash once to make test suite blazingly fast
CACHED_HASH = get_password_hash("Chotu@123")

# Disable production lifespan during unit/integration tests so it doesn't hit localhost:5432
@asynccontextmanager
async def mock_lifespan(_):
    yield

app.router.lifespan_context = mock_lifespan

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session(monkeypatch):
    clear_revoked_tokens()
    # Mock get_password_hash in initial_data to use precomputed hash
    monkeypatch.setattr("app.initial_data.get_password_hash", lambda _: CACHED_HASH)
    
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    init_demo_db(db)
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def auth_headers(db_session):
    """Helper fixture to generate signed JWT bearer tokens for any role."""
    def _get_headers(role=UserRole.MANAGER, restaurant_id="rest-spice-jct"):
        user = db_session.query(User).filter(User.role == role, User.restaurant_id == restaurant_id).first()
        uid = user.id if user else f"user-{role.value}-01"
        token = create_access_token(
            subject=uid,
            extra_claims={"role": role.value, "restaurant_id": restaurant_id}
        )
        return {"Authorization": f"Bearer {token}"}
    return _get_headers

@pytest.fixture(scope="function")
def client(db_session, auth_headers):
    """
    Authenticated TestClient default fixture.
    Supplies valid manager bearer token for standard business workflow operations.
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    headers = auth_headers(role=UserRole.MANAGER)
    with TestClient(app, headers=headers) as c:
        yield c
    app.dependency_overrides.clear()

@pytest.fixture(scope="function")
def unauthenticated_client(db_session):
    """TestClient without any Authorization header."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
