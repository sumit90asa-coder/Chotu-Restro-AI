import uuid
from app.models.restaurant import Restaurant
from app.models.user import User

def test_fresh_owner_and_restaurant_registration(client):
    unique_id = uuid.uuid4().hex[:6]
    reg_payload = {
        "full_name": "Kavita Rao",
        "email": f"kavita_{unique_id}@artisanalbistro.in",
        "phone": f"+9198{unique_id[:8]}",
        "password": "SecurePassword@123",
        "restaurant_name": f"Artisanal Bistro {unique_id}",
        "restaurant_type": "cafe",
        "address": "42 Indigo Lane, Indiranagar",
        "city": "Bengaluru",
        "state": "Karnataka",
        "pincode": "560038",
        "country": "India",
        "gstin": "29AABCU9603R1ZM",
        "fssai_number": "11521005000432",
        "business_hours": "08:00 AM - 11:00 PM"
    }
    
    resp = client.post("/api/v1/auth/register", json=reg_payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert "access_token" in data
    assert data["role"] == "owner"
    assert data["email"] == reg_payload["email"]
    assert data["restaurant_name"] == reg_payload["restaurant_name"]
    assert data["restaurant_id"].startswith("rest-")
    assert data["user_id"].startswith("user-own-")

def test_duplicate_registration_rejected(client):
    unique_id = uuid.uuid4().hex[:6]
    reg_payload = {
        "full_name": "Rohan Deshmukh",
        "email": f"rohan_{unique_id}@testcafe.in",
        "phone": f"+9199{unique_id[:8]}",
        "password": "SecurePassword@123",
        "restaurant_name": "Test Café",
        "address": "12 Hill Road",
        "city": "Pune",
    }
    # First registration -> 201
    resp1 = client.post("/api/v1/auth/register", json=reg_payload)
    assert resp1.status_code == 201

    # Second registration with same email -> 409 Conflict
    resp2 = client.post("/api/v1/auth/register", json=reg_payload)
    assert resp2.status_code == 409
    assert "already exists" in resp2.json()["detail"].lower()

def test_login_with_email_and_mobile(client):
    unique_id = uuid.uuid4().hex[:6]
    test_phone = f"+9197{unique_id[:8]}"
    test_email = f"test_{unique_id}@punebistro.com"
    test_pass = "BistroSecure@123"

    reg_payload = {
        "full_name": "Siddharth Verma",
        "email": test_email,
        "phone": test_phone,
        "password": test_pass,
        "restaurant_name": "Pune Bistro",
        "address": "100 FC Road",
        "city": "Pune",
    }
    reg_resp = client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_resp.status_code == 201

    # 1. Login via Email
    login_email_resp = client.post(
        "/api/v1/auth/login",
        json={"email": test_email, "password": test_pass}
    )
    assert login_email_resp.status_code == 200
    assert "access_token" in login_email_resp.json()
    assert login_email_resp.json()["role"] == "owner"

    # 2. Login via Mobile Identifier
    login_phone_resp = client.post(
        "/api/v1/auth/login",
        json={"identifier": test_phone, "password": test_pass}
    )
    assert login_phone_resp.status_code == 200
    assert "access_token" in login_phone_resp.json()
    assert login_phone_resp.json()["role"] == "owner"

def test_login_invalid_password(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": "nonexistent@test.com", "password": "WrongPassword"}
    )
    assert response.status_code == 401

def test_get_me(client):
    unique_id = uuid.uuid4().hex[:6]
    test_email = f"owner_{unique_id}@test.com"
    test_pass = "TestOwner@123"

    client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Owner Profile Test",
            "email": test_email,
            "phone": f"+9196{unique_id[:8]}",
            "password": test_pass,
            "restaurant_name": "Profile Test Restaurant",
            "address": "1 Main St",
            "city": "Mumbai",
        }
    )

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": test_email, "password": test_pass}
    )
    token = login_resp.json()["access_token"]
    
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["email"] == test_email
    assert response.json()["role"] == "owner"
