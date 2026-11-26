import pytest
from fastapi.testclient import TestClient

def test_logout_revocation_lifecycle(unauthenticated_client: TestClient, db_session):
    client = unauthenticated_client

    # 1. Login with test restaurant owner
    login_resp = client.post("/api/v1/auth/login", json={
        "identifier": "owner@spicejunction.in",
        "password": "Chotu@123"
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token_data = login_resp.json()
    token = token_data["access_token"]
    assert token

    headers = {"Authorization": f"Bearer {token}"}

    # 2. Access protected endpoint /me
    me_resp = client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "owner@spicejunction.in"

    # 3. Explicitly logout and revoke session
    logout_resp = client.post("/api/v1/auth/logout", headers=headers)
    assert logout_resp.status_code == 200
    assert logout_resp.json()["status"] == "logged_out"

    # 4. Attempt to access protected endpoint with the revoked token -> must be HTTP 401
    revoked_resp = client.get("/api/v1/auth/me", headers=headers)
    assert revoked_resp.status_code == 401, f"Revoked token was unexpectedly accepted: {revoked_resp.status_code}"

    # 5. Anonymous access -> must be HTTP 401
    anon_resp = client.get("/api/v1/auth/me")
    assert anon_resp.status_code == 401

    # 6. Re-authenticate cleanly -> must succeed and issue a new valid token
    relogin_resp = client.post("/api/v1/auth/login", json={
        "identifier": "owner@spicejunction.in",
        "password": "Chotu@123"
    })
    assert relogin_resp.status_code == 200
    new_token = relogin_resp.json()["access_token"]
    assert new_token != token

    new_me_resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {new_token}"})
    assert new_me_resp.status_code == 200
