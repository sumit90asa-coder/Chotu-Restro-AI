from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.coupon import Coupon

def test_coupon_postgres_persistence_and_validation(client: TestClient, db_session: Session):
    # 1. Create a promo code via authenticated management API
    create_payload = {
        "code": "FESTIVE30",
        "description": "30% off on festive family dining",
        "discount_type": "percentage",
        "discount_value": 30.00,
        "min_order_value": 500.00,
        "max_discount": 300.00,
        "usage_limit": 500
    }
    create_resp = client.post("/api/v1/marketing/coupons", json=create_payload)
    assert create_resp.status_code == 201, f"Create failed: {create_resp.text}"
    coupon_data = create_resp.json()
    coupon_id = coupon_data["id"]
    assert coupon_data["code"] == "FESTIVE30"
    assert coupon_data["is_active"] is True

    # 2. Verify coupon exists in PostgreSQL database
    db_coupon = db_session.query(Coupon).filter(Coupon.id == coupon_id).first()
    assert db_coupon is not None
    assert db_coupon.code == "FESTIVE30"
    assert db_coupon.is_active is True

    # 3. Validate coupon against subtotal below minimum threshold -> valid: False
    low_val_resp = client.post("/api/v1/marketing/coupons/validate", json={
        "code": "FESTIVE30",
        "subtotal": 350.00
    })
    assert low_val_resp.status_code == 200
    low_data = low_val_resp.json()
    assert low_data["valid"] is False
    assert "Minimum order value" in low_data["message"]

    # 4. Validate coupon with eligible subtotal -> valid: True, check discount calculation
    valid_resp = client.post("/api/v1/marketing/coupons/validate", json={
        "code": "FESTIVE30",
        "subtotal": 800.00
    })
    assert valid_resp.status_code == 200
    val_data = valid_resp.json()
    assert val_data["valid"] is True
    # 30% of 800 is 240
    assert val_data["discount_amount"] == 240.00
    assert val_data["final_subtotal"] == 560.00

    # 5. Toggle coupon status to DISABLED in PostgreSQL
    toggle_resp = client.patch(f"/api/v1/marketing/coupons/{coupon_id}/toggle")
    assert toggle_resp.status_code == 200
    assert toggle_resp.json()["is_active"] is False

    # Verify database record updated
    db_session.refresh(db_coupon)
    assert db_coupon.is_active is False

    # 6. Attempt validation on disabled coupon -> must be rejected even with valid cart
    disabled_val_resp = client.post("/api/v1/marketing/coupons/validate", json={
        "code": "FESTIVE30",
        "subtotal": 800.00
    })
    assert disabled_val_resp.status_code == 200
    assert disabled_val_resp.json()["valid"] is False
    assert "currently disabled" in disabled_val_resp.json()["message"]

    # 7. Delete coupon
    del_resp = client.delete(f"/api/v1/marketing/coupons/{coupon_id}")
    assert del_resp.status_code == 200
    assert db_session.query(Coupon).filter(Coupon.id == coupon_id).first() is None
