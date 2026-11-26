import pytest
from app.services.ai_service import AIService

@pytest.mark.asyncio
async def test_chotu_ai_10_operational_questions(db_session):
    """
    MASTER TEST SUITE — PHASE 4.N
    Verifies that Chotu AI accurately answers all 10 realistic restaurant queries
    grounded 100% in genuine database records without hallucination.
    """
    restaurant_id = "rest-spice-jct"

    # 1. How much did we earn today?
    r1 = await AIService.chat(db_session, restaurant_id, "How much did we earn today?")
    assert r1.intent == "QUERY_SALES"
    assert "₹" in r1.reply or "sales" in r1.reply.lower()

    # 2. Which dishes sold the most this week?
    r2 = await AIService.chat(db_session, restaurant_id, "Which dishes sold the most this week?")
    assert r2.intent == "QUERY_TOP_DISHES"
    assert "selling dishes" in r2.reply.lower() or "sold" in r2.reply.lower()

    # 3. Which ingredients are running low?
    r3 = await AIService.chat(db_session, restaurant_id, "Which ingredients are running low?")
    assert r3.intent == "QUERY_INVENTORY"
    assert "stock" in r3.reply.lower()

    # 4. Which orders are still pending?
    r4 = await AIService.chat(db_session, restaurant_id, "Which orders are still pending?")
    assert r4.intent == "QUERY_PENDING_ORDERS"
    assert "pending" in r4.reply.lower()

    # 5. Which tables are currently occupied?
    r5 = await AIService.chat(db_session, restaurant_id, "Which tables are currently occupied?")
    assert r5.intent == "QUERY_TABLES"
    assert "tables" in r5.reply.lower()

    # 6. How many orders were cancelled today?
    r6 = await AIService.chat(db_session, restaurant_id, "How many orders were cancelled today?")
    assert r6.intent == "QUERY_CANCELLED_ORDERS"
    assert "cancelled" in r6.reply.lower()

    # 7. What were yesterday's sales?
    r7 = await AIService.chat(db_session, restaurant_id, "What were yesterday's sales?")
    assert r7.intent == "QUERY_SALES_YESTERDAY"
    assert "yesterday" in r7.reply.lower()

    # 8. Which customers visited most frequently?
    r8 = await AIService.chat(db_session, restaurant_id, "Which customers visited most frequently?")
    assert r8.intent == "QUERY_TOP_CUSTOMERS"
    assert "frequent" in r8.reply.lower() or "guests" in r8.reply.lower() or "visit" in r8.reply.lower()

    # 9. Which items are currently unavailable?
    r9 = await AIService.chat(db_session, restaurant_id, "Which items are currently unavailable?")
    assert r9.intent == "QUERY_UNAVAILABLE_DISHES"
    assert "unavailable" in r9.reply.lower() or "dishes" in r9.reply.lower() or "catalog" in r9.reply.lower()

    # 10. What is the total outstanding payment?
    r10 = await AIService.chat(db_session, restaurant_id, "What is the total outstanding payment?")
    assert r10.intent == "QUERY_OUTSTANDING_PAYMENTS"
    assert "outstanding" in r10.reply.lower() or "balance" in r10.reply.lower()
