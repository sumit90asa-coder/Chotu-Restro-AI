import pytest
from app.models.menu import MenuItem, MenuCategory

def test_menu_item_create_and_delete_lifecycle(client, auth_headers):
    """
    Verify creating a menu item, checking its category resolution,
    and deleting (deactivating) it from the menu catalog.
    """
    headers = auth_headers()

    # 1. Create a test menu item
    create_resp = client.post(
        "/api/v1/menu/items",
        json={
            "name": "Paneer Tikka Test Dish",
            "category": "Starters",
            "price": 280.0,
            "description": "Charred cottage cheese cubes with tandoori spices",
            "dietary": "veg",
            "station": "tandoor",
            "preparation_time_minutes": 15
        },
        headers=headers
    )
    assert create_resp.status_code == 200
    dish_data = create_resp.json()
    dish_id = dish_data["id"]
    assert dish_data["name"] == "Paneer Tikka Test Dish"
    assert dish_data["category_name"] == "Starters"

    # 2. Verify dish is visible in active menu items
    list_resp = client.get("/api/v1/menu/items", headers=headers)
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert any(i["id"] == dish_id for i in items)

    # 3. Delete the menu item
    del_resp = client.delete(f"/api/v1/menu/items/{dish_id}", headers=headers)
    assert del_resp.status_code == 200
    del_data = del_resp.json()
    assert del_data["success"] is True

    # 4. Verify dish is no longer in active menu
    list_resp_after = client.get("/api/v1/menu/items", headers=headers)
    assert list_resp_after.status_code == 200
    items_after = list_resp_after.json()
    assert not any(i["id"] == dish_id for i in items_after)

    # 5. Deleting already deleted or non-existent dish returns 404
    del_nonexistent = client.delete("/api/v1/menu/items/dish-doesnotexist-1234", headers=headers)
    assert del_nonexistent.status_code == 404
