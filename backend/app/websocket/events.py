from typing import Dict, Any

class WSEventType:
    ORDER_CREATED = "ORDER_CREATED"
    ORDER_UPDATED = "ORDER_UPDATED"
    KOT_CREATED = "KOT_CREATED"
    KOT_UPDATED = "KOT_UPDATED"
    TABLE_UPDATED = "TABLE_UPDATED"
    STOCK_UPDATED = "STOCK_UPDATED"
    DISH_STOCK_TOGGLED = "DISH_STOCK_TOGGLED"
    SERVICE_REQUEST = "SERVICE_REQUEST"

def create_ws_message(event_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "event": event_type,
        "data": data
    }
