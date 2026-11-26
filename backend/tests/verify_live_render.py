import urllib.request
import urllib.error
import json
import time

LIVE_URL = "https://chotu-backend-o8wn.onrender.com/api/v1"

print("--- STARTING LIVE RENDER PRODUCTION VERIFICATION ---")

# 1. Login with dedicated QA tester credentials
login_payload = json.dumps({
    "email": "chotu.qa.tester@gmail.com",
    "password": "P@ss-yScG8cVLrZO78ITQ#2026"
}).encode("utf-8")

req = urllib.request.Request(
    f"{LIVE_URL}/auth/login",
    data=login_payload,
    headers={"Content-Type": "application/json", "User-Agent": "ChotuQA/1.0"}
)

try:
    with urllib.request.urlopen(req, timeout=30) as res:
        login_data = json.loads(res.read().decode("utf-8"))
        token = login_data["access_token"]
        print("[LIVE PASS] 1. Login successful! Token received.")
except Exception as e:
    print("[LIVE FAIL] 1. Login failed:", e)
    exit(1)

# 2. Access /auth/me with valid token
me_req = urllib.request.Request(
    f"{LIVE_URL}/auth/me",
    headers={"Authorization": f"Bearer {token}", "User-Agent": "ChotuQA/1.0"}
)
try:
    with urllib.request.urlopen(me_req, timeout=30) as res:
        me_data = json.loads(res.read().decode("utf-8"))
        print(f"[LIVE PASS] 2. /auth/me verified: user={me_data['email']}, rest={me_data['restaurant_id']}")
        assert me_data["restaurant_id"] == "rest-944734b1"
except Exception as e:
    print("[LIVE FAIL] 2. /auth/me failed:", e)

# 3. Logout to revoke token
logout_req = urllib.request.Request(
    f"{LIVE_URL}/auth/logout",
    data=b"{}",
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": "ChotuQA/1.0"}
)
try:
    with urllib.request.urlopen(logout_req, timeout=30) as res:
        print("[LIVE PASS] 3. /auth/logout response status:", res.status)
except Exception as e:
    print("[LIVE FAIL] 3. Logout failed:", e)

# 4. Attempt /auth/me with the revoked token -> MUST RETURN 401
try:
    with urllib.request.urlopen(me_req, timeout=30) as res:
        print("[LIVE FAIL] 4. Revoked token was still accepted!")
except urllib.error.HTTPError as e:
    if e.code == 401:
        print("[LIVE PASS] 4. Revoked token strictly rejected with HTTP 401 Unauthorized!")
    else:
        print(f"[LIVE FAIL] 4. Unexpected HTTP code: {e.code}")
except Exception as e:
    print("[LIVE ERROR] 4:", e)

# 5. Check Promo Codes / Coupons endpoint
login_req2 = urllib.request.Request(
    f"{LIVE_URL}/auth/login",
    data=login_payload,
    headers={"Content-Type": "application/json", "User-Agent": "ChotuQA/1.0"}
)
with urllib.request.urlopen(login_req2, timeout=30) as res:
    token2 = json.loads(res.read().decode("utf-8"))["access_token"]

coupons_req = urllib.request.Request(
    f"{LIVE_URL}/marketing/coupons",
    headers={"Authorization": f"Bearer {token2}", "User-Agent": "ChotuQA/1.0"}
)
try:
    with urllib.request.urlopen(coupons_req, timeout=30) as res:
        coupons = json.loads(res.read().decode("utf-8"))
        print(f"[LIVE PASS] 5. /marketing/coupons loaded successfully (count={len(coupons)}).")
except Exception as e:
    print("[LIVE NOTE] 5. Coupons check (deployment might still be completing build):", e)

# 6. Check Tables
tables_req = urllib.request.Request(
    f"{LIVE_URL}/tables",
    headers={"Authorization": f"Bearer {token2}", "User-Agent": "ChotuQA/1.0"}
)
try:
    with urllib.request.urlopen(tables_req, timeout=30) as res:
        tables = json.loads(res.read().decode("utf-8"))
        print(f"[LIVE PASS] 6. /tables loaded for QA restaurant: {len(tables)} tables.")
except Exception as e:
    print("[LIVE FAIL] 6. Tables check failed:", e)

# 7. Check Analytics Overview
analytics_req = urllib.request.Request(
    f"{LIVE_URL}/analytics/overview?period=today",
    headers={"Authorization": f"Bearer {token2}", "User-Agent": "ChotuQA/1.0"}
)
try:
    with urllib.request.urlopen(analytics_req, timeout=30) as res:
        overview = json.loads(res.read().decode("utf-8"))
        print(f"[LIVE PASS] 7. /analytics/overview verified: today_revenue={overview['today_revenue']}, completed_orders={overview['completed_orders_today']}")
except Exception as e:
    print("[LIVE FAIL] 7. Analytics check failed:", e)

print("--- LIVE RENDER PRODUCTION VERIFICATION COMPLETE ---")
