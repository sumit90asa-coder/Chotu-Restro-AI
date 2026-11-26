import pytest
from sqlalchemy.orm import Session
from app.services.ai_service import AIService
from app.models.menu import MenuItem
from app.models.table import DiningTable
from app.models.order import Order
from app.models.kot import KOT
from app.models.audit_log import AuditLog

@pytest.mark.asyncio
async def test_chotu_ai_real_database_actions(db_session: Session):
    restaurant_id = "rest-spice-jct"

    # 1. Test Action: Mark Gulab Jamun out of stock
    # Ensure item exists in DB
    item = db_session.query(MenuItem).filter(
        MenuItem.restaurant_id == restaurant_id,
        MenuItem.name.ilike("%gulab jamun%")
    ).first()
    if not item:
        item = MenuItem(
            id="dish-test-gj",
            restaurant_id=restaurant_id,
            category_id="cat-dessert-01",
            name="Gulab Jamun",
            price=120.00,
            is_active=True,
            is_in_stock=True
        )
        db_session.add(item)
        db_session.commit()

    assert item.is_in_stock is True

    # Execute voice action via Chotu AI
    res = await AIService.chat(db_session, restaurant_id, "Gulab Jamun out of stock mark karo")
    assert res.suggested_action == "MARK_OUT_OF_STOCK"
    assert "marked Out of Stock" in res.reply

    # Verify actual database state
    db_session.refresh(item)
    assert item.is_in_stock is False, "Item should be persisted as out of stock in PostgreSQL"

    # 2. Test Action: Add Garlic Naan to Table 4
    # Ensure Table 4 exists
    t4 = db_session.query(DiningTable).filter(
        DiningTable.restaurant_id == restaurant_id,
        DiningTable.label == "T-04"
    ).first()
    if not t4:
        t4 = DiningTable(
            id="tbl-test-t4",
            restaurant_id=restaurant_id,
            label="T-04",
            capacity=4
        )
        db_session.add(t4)
        db_session.commit()

    add_res = await AIService.chat(db_session, restaurant_id, "Table 4 pe 2 Garlic Naan add karo")
    assert add_res.suggested_action == "ADD_ITEMS_TO_KOT"
    assert "Added" in add_res.reply

    # Verify that an actual active Order and KOT were created in the database
    db_session.refresh(t4)
    assert t4.current_order_id is not None
    order = db_session.query(Order).filter(Order.id == t4.current_order_id).first()
    assert order is not None
    assert len(order.items) >= 1

    kot = db_session.query(KOT).filter(KOT.order_id == order.id).first()
    assert kot is not None
    assert kot.status.value != "bumped"

    # 3. Test Action: WhatsApp billing dispatch
    wa_res = await AIService.chat(db_session, restaurant_id, "Table 4 ka bill WhatsApp pe bhejo")
    assert wa_res.suggested_action == "DISPATCH_WHATSAPP_BILL"
    assert "dispatched via WhatsApp" in wa_res.reply

    # Verify audit log entry in PostgreSQL
    audit = db_session.query(AuditLog).filter(
        AuditLog.restaurant_id == restaurant_id,
        AuditLog.action == "WHATSAPP_BILL_DISPATCH"
    ).first()
    assert audit is not None
    assert "whatsapp" in audit.details
