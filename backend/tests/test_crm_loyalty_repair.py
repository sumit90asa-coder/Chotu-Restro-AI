import pytest
from fastapi.testclient import TestClient

def test_loyalty_crm_points_and_visits(client: TestClient, db_session):
    # 1. Create a new test customer
    create_resp = client.post("/api/v1/customers", json={
        "name": "Kavita Rao",
        "phone": "+919833445566",
        "email": "kavita.rao@example.com"
    })
    assert create_resp.status_code == 200, f"Customer create failed: {create_resp.text}"
    cust = create_resp.json()
    cust_id = cust["id"]
    
    # Verify initial point balance is NOT None/NULL, but integer 0
    assert cust["loyalty_points_balance"] == 0
    assert cust["loyalty_points"] == 0
    assert cust["visit_count"] == 0
    assert cust["total_orders"] == 0

    # 2. Add loyalty points manually (Issue 32)
    idemp_key = "test-loyalty-idemp-01"
    adjust_resp = client.post(f"/api/v1/customers/{cust_id}/loyalty", json={
        "points": 150,
        "reason": "VIP dining bonus",
        "idempotency_key": idemp_key
    })
    assert adjust_resp.status_code == 200, f"Adjust loyalty failed: {adjust_resp.text}"
    updated = adjust_resp.json()
    assert updated["loyalty_points_balance"] == 150
    assert updated["loyalty_points"] == 150

    # 3. Prevent duplicate points on repeated submission with same idempotency key
    duplicate_resp = client.post(f"/api/v1/customers/{cust_id}/loyalty", json={
        "points": 150,
        "reason": "VIP dining bonus",
        "idempotency_key": idemp_key
    })
    assert duplicate_resp.status_code == 200
    assert duplicate_resp.json()["loyalty_points_balance"] == 150

    # 4. Search customer profile and verify persistence
    search_resp = client.get("/api/v1/customers?q=Kavita")
    assert search_resp.status_code == 200
    results = search_resp.json()
    assert len(results) >= 1
    found = next((c for c in results if c["id"] == cust_id), None)
    assert found is not None
    assert found["loyalty_points"] == 150
    assert found["visit_count"] == 0
