import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.database.session import Base, engine, SessionLocal
from app.models import *  # ensure all models are registered
from app.api.v1 import (
    auth, tables, menu, pos, qr, kds, orders, inventory, analytics, ai,
    settings as settings_api, staff, customers, delivery, suppliers, notifications, coupons
)
from app.websocket.manager import ws_manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database migrations / schemas are up to date on container startup
    try:
        from alembic import command
        from alembic.config import Config
        alembic_ini_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "alembic.ini")
        if os.path.exists(alembic_ini_path):
            alembic_cfg = Config(alembic_ini_path)
            command.upgrade(alembic_cfg, "head")
    except Exception as e:
        import logging
        logging.getLogger("uvicorn").warning(f"Startup alembic migration notice: {e}")

    # Ensure all tables exist on startup
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health Check
@app.get("/health")
@app.get(f"{settings.API_V1_STR}/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Chotu Restro AI Backend",
        "version": "1.0.0",
        "currency": "INR"
    }

# API v1 Routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(tables.router, prefix=f"{settings.API_V1_STR}/tables", tags=["Dining Tables"])
app.include_router(menu.router, prefix=f"{settings.API_V1_STR}/menu", tags=["Menu"])
app.include_router(pos.router, prefix=f"{settings.API_V1_STR}/pos", tags=["Point of Sale"])
app.include_router(qr.router, prefix=f"{settings.API_V1_STR}/qr", tags=["QR Ordering"])
app.include_router(kds.router, prefix=f"{settings.API_V1_STR}/kds", tags=["Kitchen Display System"])
app.include_router(orders.router, prefix=f"{settings.API_V1_STR}/orders", tags=["Orders & Dispatch"])
app.include_router(inventory.router, prefix=f"{settings.API_V1_STR}/inventory", tags=["Inventory & Recipes"])
app.include_router(analytics.router, prefix=f"{settings.API_V1_STR}/analytics", tags=["Operational Analytics"])
app.include_router(ai.router, prefix=f"{settings.API_V1_STR}/ai", tags=["Chotu AI Assistant"])
app.include_router(settings_api.router, prefix=f"{settings.API_V1_STR}/settings", tags=["Restaurant Settings"])
app.include_router(staff.router, prefix=f"{settings.API_V1_STR}/staff", tags=["Staff Management"])
app.include_router(customers.router, prefix=f"{settings.API_V1_STR}/customers", tags=["Customer CRM & Loyalty"])
app.include_router(delivery.router, prefix=f"{settings.API_V1_STR}/delivery", tags=["Delivery & Dispatch"])
app.include_router(suppliers.router, prefix=f"{settings.API_V1_STR}/suppliers", tags=["Suppliers & Purchase Orders"])
app.include_router(notifications.router, prefix=f"{settings.API_V1_STR}/notifications", tags=["In-App Notifications"])
app.include_router(coupons.router, prefix=f"{settings.API_V1_STR}/marketing/coupons", tags=["Marketing & Promo Codes"])

# WebSocket Endpoint
@app.websocket("/ws/{restaurant_id}")
async def websocket_endpoint(websocket: WebSocket, restaurant_id: str):
    await ws_manager.connect(websocket, restaurant_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, restaurant_id)
