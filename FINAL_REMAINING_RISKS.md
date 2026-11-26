# CHOTU RESTRO AI — FINAL REMAINING RISKS REGISTER

**Document Version:** 1.0.0  
**Audit Date:** November 26, 2026  
**Status:** ACTIVE RISK REGISTER  

---

## 1. RISK ASSESSMENT MATRIX

| Risk ID | Category | Risk Description | Severity | Probability | Status | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RISK-01** | Infrastructure | Render Free-Tier Container Spin-Down (50s cold start after 15m inactivity) | MEDIUM | HIGH | **OPEN** | Upgrade both Frontend and Backend web services to Render Starter plan ($7/mo per instance) for 100% persistent uptime. |
| **RISK-02** | Scaling | Memory Exhaustion under 250+ concurrent WebSockets on 512MB RAM free dynos | HIGH | MEDIUM | **UNVERIFIED** | Enforce client heartbeat ping/pong interval, implement Redis PubSub for WebSocket distribution across multiple workers. |
| **RISK-03** | Payments | Operating in Razorpay Test Mode with mock credentials | LOW | HIGH | **PARTIAL** | Provision genuine Razorpay Production Key ID and Key Secret in Render backend environment variables before taking real customer credit cards/UPI. |
| **RISK-04** | Notifications | WhatsApp & SMS alerts logging to stdout instead of delivering to customer handsets | LOW | HIGH | **PARTIAL** | Configure Twilio or Gupshup API credentials in backend environment to enable live SMS/WhatsApp KOT dispatch. |
| **RISK-05** | Database | Direct PostgreSQL connection limits without PgBouncer | MEDIUM | LOW | **OPEN** | When scaling beyond 10 concurrent POS and KDS stations, enable PgBouncer transaction pooling (`port 6543`) on PostgreSQL server. |
| **RISK-06** | Hardware | Thermal Receipt Printing relies on browser `window.print()` dialog | LOW | LOW | **OPEN** | For seamless silent thermal printing, install QZ Tray or direct raw TCP 9100 ESC/POS print driver on cashier terminal. |

---

## 2. DETAILED RISK BREAKDOWN & REMEDIATION ROADMAP

### RISK-01: Render Free-Tier Container Ephemeral Spin-Down
- **Impact:** When no orders are placed for 15 minutes, Render spins down the backend container. The next diner scanning the QR code or cashier opening the POS encounters a 50-60 second delay while the container boots and runs `alembic upgrade head`.
- **Remediation:** In `render.yaml`, change `plan: free` to `plan: starter`.

### RISK-02: High-Volume WebSocket Concurrency (250+ Terminals)
- **Impact:** Each active dining table and KDS tablet holds an open WebSocket connection to FastAPI (`/ws/pos/{restaurant_id}`). Render free instances are capped at 512MB RAM and 0.1 CPU core. Under 250 concurrent open sockets, Python asyncio memory overhead may trigger an Out-Of-Memory (OOM) restart.
- **Remediation:** Upgrade compute tier or deploy a lightweight standalone WebSocket broker (e.g. Node.js or Redis PubSub).

### RISK-03: Razorpay Test Mode Configuration
- **Impact:** Online payment links generate test payment tokens. Diners cannot pay with genuine UPI apps or credit cards until live merchant keys are set.
- **Remediation:** Restaurant owner must complete Razorpay KYC, generate Live API keys, and update `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.

### RISK-04: Notification Service Console Stub
- **Impact:** Delivery dispatch OTPs and invoice links are generated, cryptographically signed, and logged to application stdout, but not sent via SMS/WhatsApp without gateway credentials.
- **Remediation:** Provision Twilio or Gupshup credentials.

---

## 3. UNCONDITIONAL GO CHECKLIST

To transition from **CONDITIONAL GO** to **UNCONDITIONAL GO**:

1. [ ] Upgrade Render backend to Starter ($7/mo)
2. [ ] Upgrade Render frontend to Starter ($7/mo)
3. [ ] Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in production env
4. [ ] Set `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` in production env
5. [ ] Configure PgBouncer pooler URL in `DATABASE_URL`
