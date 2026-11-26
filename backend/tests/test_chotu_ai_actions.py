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


@pytest.mark.asyncio
async def test_chotu_ai_table_resolution_ignores_uuid_digits(db_session: Session):
    """Ensure 'table 1' resolves to Table 1 even if Table 5 has '1' in its UUID."""
    from app.models.restaurant import Restaurant
    import uuid

    rid = f"rest-tbl-test-{uuid.uuid4().hex[:6]}"
    rest = Restaurant(
        id=rid,
        name="Table Test Kitchen",
        code=f"TT-{uuid.uuid4().hex[:4]}",
        address="123 Test St",
        phone="9999999999",
    )
    t5 = DiningTable(id="tbl-55551111", restaurant_id=rid, label="Table 5", capacity=4, qr_token=f"qr-t5-{uuid.uuid4().hex[:6]}")
    t1 = DiningTable(id="tbl-9999aaaa", restaurant_id=rid, label="Table 1", capacity=4, qr_token=f"qr-t1-{uuid.uuid4().hex[:6]}")
    roti = MenuItem(
        id=f"dish-roti-{uuid.uuid4().hex[:6]}",
        restaurant_id=rid,
        category_id="cat-breads-01",
        name="Tandoori Roti",
        price=30.00,
        is_active=True,
        is_in_stock=True,
    )
    db_session.add_all([rest, t5, t1, roti])
    db_session.commit()

    res = await AIService.chat(db_session, rid, "add 2 roti to table 1")
    assert res.suggested_action == "ADD_ITEMS_TO_KOT"

    db_session.refresh(t1)
    db_session.refresh(t5)
    assert t1.current_order_id is not None, "Table 1 should receive the order"
    assert t5.current_order_id is None, "Table 5 must NOT receive Table 1's order"


@pytest.mark.asyncio
async def test_chotu_ai_update_table_status(db_session: Session):
    """Ensure Chotu AI can update table statuses (occupied, reserved, billed, vacant)."""
    from app.models.restaurant import Restaurant
    from app.models.table import TableStatus
    import uuid

    rid = f"rest-status-test-{uuid.uuid4().hex[:6]}"
    rest = Restaurant(
        id=rid,
        name="Status Test Kitchen",
        code=f"ST-{uuid.uuid4().hex[:4]}",
        address="123 Test St",
        phone="9999999999",
    )
    t1 = DiningTable(id=f"tbl-1-{uuid.uuid4().hex[:6]}", restaurant_id=rid, label="Table 1", capacity=4, qr_token=f"qr-s1-{uuid.uuid4().hex[:6]}")
    t2 = DiningTable(id=f"tbl-2-{uuid.uuid4().hex[:6]}", restaurant_id=rid, label="Table 2", capacity=4, qr_token=f"qr-s2-{uuid.uuid4().hex[:6]}")
    db_session.add_all([rest, t1, t2])
    db_session.commit()

    # Set Table 1 to OCCUPIED
    res_occ = await AIService.chat(db_session, rid, "set table 1 as occupied")
    assert res_occ.suggested_action == "UPDATE_TABLE_STATUS"
    db_session.refresh(t1)
    assert t1.status == TableStatus.OCCUPIED
    assert t1.current_order_id is not None

    # Set Table 2 to RESERVED
    res_res = await AIService.chat(db_session, rid, "reserve table 2")
    assert res_res.suggested_action == "UPDATE_TABLE_STATUS"
    db_session.refresh(t2)
    assert t2.status == TableStatus.RESERVED

    # Clear Table 1 back to VACANT
    res_vac = await AIService.chat(db_session, rid, "clear table 1")
    assert res_vac.suggested_action == "UPDATE_TABLE_STATUS"
    db_session.refresh(t1)
    assert t1.status == TableStatus.VACANT
    assert t1.current_order_id is None
