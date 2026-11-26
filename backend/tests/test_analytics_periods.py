import pytest
from fastapi.testclient import TestClient

def test_analytics_periods_and_grounded_stats(client: TestClient, db_session):
    periods = ["today", "yesterday", "last_7_days", "this_month"]
    for p in periods:
        resp = client.get(f"/api/v1/analytics/overview?period={p}")
        assert resp.status_code == 200, f"Period {p} failed: {resp.text}"
        data = resp.json()
        assert "today_revenue" in data
        assert "channel_sales" in data
        assert len(data["channel_sales"]) == 3
        assert "weekly_traffic" in data
        assert len(data["weekly_traffic"]) == 7
        assert "top_dishes" in data
        assert "occupied_tables" in data
        assert "total_tables" in data
