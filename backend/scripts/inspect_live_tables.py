import urllib.request
import json

req = urllib.request.Request(
    'https://chotu-backend-o8wn.onrender.com/api/v1/auth/login',
    data=json.dumps({'email': 'chotu.qa.tester@gmail.com', 'password': 'P@ss-yScG8cVLrZO78ITQ#2026'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
resp = urllib.request.urlopen(req)
data = json.loads(resp.read().decode('utf-8'))
token = data['access_token']
print('Login successful!')

req2 = urllib.request.Request(
    'https://chotu-backend-o8wn.onrender.com/api/v1/tables',
    headers={'Authorization': f'Bearer {token}'}
)
resp2 = urllib.request.urlopen(req2)
tables = json.loads(resp2.read().decode('utf-8'))
for t in tables:
    label = t.get('label')
    tid = t.get('id')
    status = t.get('status')
    bill = t.get('current_bill')
    curr_ord = t.get('current_order_id')
    cap = t.get('capacity')
    print(f"Table {label} ({tid}): status={status}, bill={bill}, cap={cap}, current_order_id={curr_ord}")
    if curr_ord:
        try:
            req3 = urllib.request.Request(
                f'https://chotu-backend-o8wn.onrender.com/api/v1/pos/tables/{tid}/order',
                headers={'Authorization': f'Bearer {token}'}
            )
            resp3 = urllib.request.urlopen(req3)
            ord_data = json.loads(resp3.read().decode('utf-8'))
            print("   Order Data:", json.dumps(ord_data, indent=2))
        except Exception as e:
            print("   Error fetching order:", e)
