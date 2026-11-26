import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.revoked_token import RevokedToken
from app.core.security import create_access_token, is_token_revoked, clear_revoked_tokens

def test_persistent_token_revocation(unauthenticated_client: TestClient, db_session: Session):
    client = unauthenticated_client

    # 1. Login to obtain a genuine JWT token
    login_resp = client.post("/api/v1/auth/login", json={
        "identifier": "owner@spicejunction.in",
        "password": "Chotu@123"
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Access protected endpoint -> 200 OK
    me_resp = client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200

    # 3. Call logout -> revokes token in PostgreSQL
    logout_resp = client.post("/api/v1/auth/logout", headers=headers)
    assert logout_resp.status_code == 200
    assert logout_resp.json()["status"] == "logged_out"

    # 4. Access protected endpoint immediately with revoked token -> must fail with 401
    revoked_resp = client.get("/api/v1/auth/me", headers=headers)
    assert revoked_resp.status_code == 401

    # 5. Simulate Server / Worker Restart: Clear in-memory cache completely
    clear_revoked_tokens()

    # 6. Verify that PostgreSQL persistence keeps the token revoked after restart
    assert is_token_revoked(token, db=db_session) is True
    post_restart_resp = client.get("/api/v1/auth/me", headers=headers)
    assert post_restart_resp.status_code == 401, "Token should remain rejected after in-memory cache clear"

    # 7. Verify RevokedToken record exists in database
    rev_record = db_session.query(RevokedToken).filter(RevokedToken.token == token).first()
    assert rev_record is not None
    assert rev_record.revoked_at is not None

    # 8. Re-authenticate cleanly -> must generate a distinct valid token
    relogin_resp = client.post("/api/v1/auth/login", json={
        "identifier": "owner@spicejunction.in",
        "password": "Chotu@123"
    })
    assert relogin_resp.status_code == 200
    new_token = relogin_resp.json()["access_token"]
    assert new_token != token
    new_headers = {"Authorization": f"Bearer {new_token}"}
    assert client.get("/api/v1/auth/me", headers=new_headers).status_code == 200
