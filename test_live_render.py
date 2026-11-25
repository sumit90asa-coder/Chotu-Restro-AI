import time
import json
import urllib.request
import urllib.error
import os

FRONTEND_URL = "https://chotu-frontend-08tk.onrender.com"
BACKEND_URL = "https://chotu-backend-jknt.onrender.com"

class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

opener = urllib.request.build_opener(NoRedirectHandler)

def test_request(method, url, headers=None, data=None):
    if headers is None:
        headers = {}
    if "User-Agent" not in headers:
        headers["User-Agent"] = "LiveRenderVerifier/1.0"
    req = urllib.request.Request(url, headers=headers, method=method)
    if data:
        req.data = json.dumps(data).encode("utf-8")
        req.headers["Content-Type"] = "application/json"
    
    start = time.time()
    try:
        resp = opener.open(req, timeout=15)
        elapsed = int((time.time() - start) * 1000)
        body = resp.read().decode("utf-8", errors="replace")
        return {
            "status": resp.status,
            "elapsed": elapsed,
            "headers": dict(resp.headers),
            "body": body[:300]
        }
    except urllib.error.HTTPError as e:
        elapsed = int((time.time() - start) * 1000)
        body = e.read().decode("utf-8", errors="replace")
        return {
            "status": e.code,
            "elapsed": elapsed,
            "headers": dict(e.headers),
            "body": body[:300]
        }
    except Exception as e:
        elapsed = int((time.time() - start) * 1000)
        return {
            "status": 0,
            "elapsed": elapsed,
            "headers": {},
            "body": str(e)
        }

tests = [
    {"id": 1, "name": "Public Root /", "method": "GET", "url": f"{FRONTEND_URL}/", "expected": "200 (Landing Page)"},
    {"id": 2, "name": "Public /landing", "method": "GET", "url": f"{FRONTEND_URL}/landing", "expected": "200 (Landing Page)"},
    {"id": 3, "name": "Public /login", "method": "GET", "url": f"{FRONTEND_URL}/login", "expected": "200 (Login Page)"},
    {"id": 4, "name": "Public /register", "method": "GET", "url": f"{FRONTEND_URL}/register", "expected": "200 (Register Page)"},
    {"id": 5, "name": "Unauthenticated /dashboard", "method": "GET", "url": f"{FRONTEND_URL}/dashboard", "expected": "307/302 Redirect to /login"},
    {"id": 6, "name": "Unauthenticated /pos", "method": "GET", "url": f"{FRONTEND_URL}/pos", "expected": "307/302 Redirect to /login"},
    {"id": 7, "name": "Unauthenticated /inventory", "method": "GET", "url": f"{FRONTEND_URL}/inventory", "expected": "307/302 Redirect to /login"},
    {"id": 8, "name": "Unauthenticated /analytics", "method": "GET", "url": f"{FRONTEND_URL}/analytics", "expected": "307/302 Redirect to /login"},
    {"id": 9, "name": "Anonymous GET /api/v1/auth/me", "method": "GET", "url": f"{BACKEND_URL}/api/v1/auth/me", "expected": "401 Unauthorized"},
    {"id": 10, "name": "Invalid JWT GET /api/v1/auth/me", "method": "GET", "url": f"{BACKEND_URL}/api/v1/auth/me", "headers": {"Authorization": "Bearer invalid_tampered_token_xyz"}, "expected": "401 Unauthorized"},
    {"id": 11, "name": "Demo token rejection", "method": "GET", "url": f"{BACKEND_URL}/api/v1/auth/me", "headers": {"Authorization": "Bearer demo-token"}, "expected": "401 Unauthorized"},
    {"id": 12, "name": "Backend /health", "method": "GET", "url": f"{BACKEND_URL}/health", "expected": "200 OK"},
    {"id": 13, "name": "Valid Owner Login", "method": "POST", "url": f"{BACKEND_URL}/api/v1/auth/login", "data": {"email": "owner@spicejunction.in", "password": "SamplePassword123"}, "expected": "200 OK with access_token (or 401 if wrong password)"}
]

print("="*80)
print("CHOTU RESTRO AI — LIVE RENDER DEPLOYMENT ACCEPTANCE SUITE")
print("="*80)

for t in tests:
    res = test_request(t["method"], t["url"], t.get("headers"), t.get("data"))
    loc = res["headers"].get("location", res["headers"].get("Location", ""))
    print(f"Test {t['id']}: {t['name']}")
    print(f"  URL: {t['url']}")
    print(f"  Expected: {t['expected']}")
    print(f"  Live Result: HTTP {res['status']} ({res['elapsed']} ms)")
    if loc:
        print(f"  Redirect Location: {loc}")
    clean_body = res['body'].replace('\n', ' ').strip()
    print(f"  Body Preview: {clean_body[:120]}")
    print("-" * 60)

