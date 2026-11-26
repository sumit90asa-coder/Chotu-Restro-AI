def test_inventory_management(client):
    # 1. Fetch ingredients
    resp = client.get("/api/v1/inventory/ingredients")
    assert resp.status_code == 200
    ingredients = resp.json()
    assert len(ingredients) >= 7

    chicken = next(i for i in ingredients if "Chicken" in i["name"])
    initial_stock = float(chicken["current_stock"])

    # 2. Adjust stock (Receive shipment)
    adj_resp = client.post(
        f"/api/v1/inventory/ingredients/{chicken['id']}/adjust",
        json={"quantity": 5.0, "transaction_type": "purchase", "notes": "New poultry delivery"}
    )
    assert adj_resp.status_code == 200
    assert float(adj_resp.json()["current_stock"]) == initial_stock + 5.0

    # 3. Check low-stock alerts
    alerts_resp = client.get("/api/v1/inventory/alerts")
    assert alerts_resp.status_code == 200
    alerts = alerts_resp.json()
    assert any("Butter" in a["name"] or "Cream" in a["name"] for a in alerts)


def test_recipe_link_metric_unit_conversion(client):
    # Fetch ingredients & menu items
    ings = client.get("/api/v1/inventory/ingredients").json()
    chicken = next(i for i in ings if i["unit"] == "kg")
    menu_items = client.get("/api/v1/menu/items").json()
    dish = menu_items[0]

    # Link 250 g of a kg-stocked ingredient -> converts to 0.25 kg
    resp = client.post(
        "/api/v1/inventory/recipes/link",
        json={
            "menu_item_id": dish["id"],
            "ingredient_id": chicken["id"],
            "quantity_required": 250,
            "unit": "g",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["quantity_required"] == 0.25
    assert resp.json()["unit"] == "kg"

    # Incompatible volume unit for a weight ingredient should be rejected
    bad_resp = client.post(
        "/api/v1/inventory/recipes/link",
        json={
            "menu_item_id": dish["id"],
            "ingredient_id": chicken["id"],
            "quantity_required": 100,
            "unit": "ml",
        },
    )
    assert bad_resp.status_code == 400
