from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.restaurant import Restaurant
from app.models.user import User
from app.models.table import DiningTable, TableStatus
from app.models.menu import MenuCategory, MenuItem, DietaryType, StationType
from app.models.inventory import Ingredient, RecipeItem
from app.models.order import Order, OrderItem, OrderMode, OrderStatus, PaymentStatus, PlacedBy
from app.models.kot import KOT, KOTItem, KOTStatus
from app.models.supplier import Supplier
from app.core.security import get_password_hash
from app.core.permissions import UserRole

def init_demo_db(db: Session):
    """
    Test fixture database initialization helper.
    Populates standard fixtures for isolated test suites (in-memory SQLite / chotu_test).
    Never called in production runtime.
    """
    # Check if demo restaurant already exists
    if db.query(Restaurant).filter(Restaurant.id == "rest-spice-jct").first():
        return

    # 1. Restaurant
    rest = Restaurant(
        id="rest-spice-jct",
        name="The Spice Junction",
        code="SPICE-JCT",
        address="Shop 4, Pali Hill Road, Bandra West, Mumbai, MH 400050",
        city="Mumbai",
        phone="+91 98200 12345",
        currency="INR",
        cgst_percent=Decimal("2.50"),
        sgst_percent=Decimal("2.50"),
        service_charge_percent=Decimal("5.00"),
        gstin="27AABCT3518Q1ZP",
        fssai_number="11521001000452",
        business_hours="11:30 AM - 11:30 PM",
        upi_vpa="thespicejunction@icici",
        invoice_prefix="SJ-INV"
    )
    db.add(rest)
    db.flush()

    # 2. Users (Owner, Manager, Cashier, Chef, Waiter)
    users_data = [
        ("user-own-01", "owner@spicejunction.in", "Aditya Hirekar (Owner)", UserRole.OWNER),
        ("user-mgr-01", "manager@spicejunction.in", "Rahul Sharma (Manager)", UserRole.MANAGER),
        ("user-csh-01", "cashier@spicejunction.in", "Deepak Nair (Cashier)", UserRole.CASHIER),
        ("user-chef-01", "chef@spicejunction.in", "Chef Vikram Rawat", UserRole.KITCHEN_STAFF),
        ("user-wtr-01", "waiter@spicejunction.in", "Gaurav Mane (Captain/Waiter)", UserRole.WAITER),
    ]
    for uid, email, name, role in users_data:
        u = User(
            id=uid,
            restaurant_id=rest.id,
            email=email,
            full_name=name,
            hashed_password=get_password_hash("Chotu@123"),
            role=role,
            is_active=True,
            phone="+91 98200 12345"
        )
        db.add(u)

    # 3. Dining Tables
    tables_data = [
        ("T-01", "T-01", 2, TableStatus.VACANT, Decimal("0.00"), None, None),
        ("T-02", "T-02", 4, TableStatus.VACANT, Decimal("0.00"), None, None),
        ("T-03", "T-03", 6, TableStatus.VACANT, Decimal("0.00"), None, None),
        ("T-04", "T-04", 4, TableStatus.OCCUPIED, Decimal("891.00"), "Ramesh K.", "20:05"),
        ("T-05", "T-05", 2, TableStatus.VACANT, Decimal("0.00"), None, None),
        ("T-06", "T-06", 8, TableStatus.RESERVED, Decimal("0.00"), None, None),
        ("T-07", "T-07", 4, TableStatus.VACANT, Decimal("0.00"), None, None),
        ("T-08", "T-08", 4, TableStatus.VACANT, Decimal("0.00"), None, None),
    ]
    for tid, label, cap, stat, bill, capt, opened in tables_data:
        t = DiningTable(
            id=tid,
            restaurant_id=rest.id,
            label=label,
            capacity=cap,
            status=stat,
            qr_token=f"qr-{tid.lower().replace('-', '')}-demo",
            current_bill=bill,
            captain_name=capt,
            opened_at=opened
        )
        db.add(t)

    # 4. Menu Categories
    cats = [
        ("cat-mains", "Mains", "mains", 1),
        ("cat-breads", "Breads", "breads", 2),
        ("cat-starters", "Starters", "starters", 3),
        ("cat-desserts", "Desserts", "desserts", 4),
        ("cat-beverages", "Beverages", "beverages", 5),
    ]
    for cid, name, slug, ord_num in cats:
        c = MenuCategory(id=cid, restaurant_id=rest.id, name=name, slug=slug, display_order=ord_num)
        db.add(c)

    # 5. Menu Items
    items_data = [
        ("dish-01", "cat-mains", "Butter Chicken (Boneless)", "Slow-simmered satin tomato makhani, dairy butter, crushed fenugreek", Decimal("340.00"), DietaryType.NONVEG, StationType.CURRY, 1, True),
        ("dish-02", "cat-mains", "Paneer Tikka Masala", "Charred cottage cheese cubes, spiced onion-capsicum roasted gravy", Decimal("290.00"), DietaryType.VEG, StationType.CURRY, 2, True),
        ("dish-03", "cat-mains", "Dal Makhani Bukhara", "Whole black urad lentils stewed 18 hours over clay oven charcoal embers", Decimal("240.00"), DietaryType.VEG, StationType.CURRY, 1, False),
        ("dish-04", "cat-breads", "Garlic Butter Naan", "Leavened oven-baked flatbread, roasted garlic slivers, fresh coriander, churned butter", Decimal("60.00"), DietaryType.VEG, StationType.TANDOOR, 1, True),
        ("dish-05", "cat-breads", "Tandoori Roti (Butter)", "Whole-wheat clay tandoor bread brushed with butter", Decimal("35.00"), DietaryType.VEG, StationType.TANDOOR, 2, True),
        ("dish-06", "cat-mains", "Hyderabadi Dum Gosht Biryani", "Layered basmati rice, tender spiced mutton, saffron milk, browned onions", Decimal("390.00"), DietaryType.NONVEG, StationType.CURRY, 3, True),
        ("dish-07", "cat-starters", "Amritsari Paneer Tikka (6 pcs)", "Ajwain-spiced hung curd marinade, crisp char, mint chutney", Decimal("280.00"), DietaryType.VEG, StationType.TANDOOR, 1, True),
        ("dish-08", "cat-starters", "Murgh Malai Tikka", "Cardamom-scented cream and cashew cheese boneless chicken kebabs", Decimal("330.00"), DietaryType.NONVEG, StationType.TANDOOR, 2, True),
        ("dish-09", "cat-desserts", "Gulab Jamun (Warm, 2 pcs)", "Reduced milk mawa spheres drenched in green cardamom saffron syrup", Decimal("110.00"), DietaryType.VEG, StationType.PANTRY, 1, True),
        ("dish-10", "cat-beverages", "Cold Coffee Frappe", "Chilled whipped coffee cream, dark chocolate drizzle", Decimal("140.00"), DietaryType.VEG, StationType.BAR, 1, True),
    ]
    for did, cid, name, desc, price, diet, stn, dord, in_stock in items_data:
        m = MenuItem(
            id=did,
            restaurant_id=rest.id,
            category_id=cid,
            name=name,
            description=desc,
            price=price,
            dietary=diet,
            station=stn,
            spice_level=dord,
            is_in_stock=in_stock,
            is_active=True
        )
        db.add(m)

    # 6. Raw Ingredients
    ingredients_data = [
        ("ing-01", "Fresh Boneless Chicken", "kg", Decimal("18.500"), Decimal("5.000"), Decimal("220.00"), "Bandra Fresh Poultry"),
        ("ing-02", "Fresh Malai Paneer", "kg", Decimal("14.000"), Decimal("3.000"), Decimal("340.00"), "Gokul Dairy Mumbai"),
        ("ing-03", "Black Urad Dal Bukhara", "kg", Decimal("25.000"), Decimal("5.000"), Decimal("140.00"), "APMC Grain Market Vashi"),
        ("ing-04", "Premium Sharbati Maida", "kg", Decimal("45.000"), Decimal("10.000"), Decimal("45.00"), "Silver Wheat Mills"),
        ("ing-05", "Heavy Dairy Cream & Butter", "kg", Decimal("2.400"), Decimal("5.000"), Decimal("480.00"), "Amul B2B Distribution"),
        ("ing-06", "Aged Basmati Rice 1121", "kg", Decimal("35.000"), Decimal("8.000"), Decimal("125.00"), "Daawat Select APMC"),
        ("ing-07", "Khoya Mawa / Reduced Milk", "kg", Decimal("3.500"), Decimal("2.000"), Decimal("360.00"), "Bandra Sweet Mart Supplies"),
    ]
    for iid, iname, unit, cstock, rthresh, cpu, supp in ingredients_data:
        ing = Ingredient(
            id=iid,
            restaurant_id=rest.id,
            name=iname,
            unit=unit,
            current_stock=cstock,
            reorder_threshold=rthresh,
            cost_per_unit=cpu,
            supplier_name=supp
        )
        db.add(ing)

    # 7. Recipes
    recipe_links = [
        ("dish-01", "ing-01", Decimal("0.250")),
        ("dish-01", "ing-05", Decimal("0.080")),
        ("dish-02", "ing-02", Decimal("0.200")),
        ("dish-02", "ing-05", Decimal("0.050")),
        ("dish-03", "ing-03", Decimal("0.150")),
        ("dish-03", "ing-05", Decimal("0.060")),
        ("dish-04", "ing-04", Decimal("0.120")),
        ("dish-04", "ing-05", Decimal("0.020")),
        ("dish-09", "ing-07", Decimal("0.100")),
    ]
    for did, iid, qreq in recipe_links:
        r = RecipeItem(
            id=f"rec-{did[-2:]}-{iid[-2:]}",
            menu_item_id=did,
            ingredient_id=iid,
            quantity_required=qreq
        )
        db.add(r)

    # 8. Initial Order for Table T-04
    ord_t4 = Order(
        id="ord-demo-t04",
        restaurant_id=rest.id,
        table_id="T-04",
        order_number="T 4 - 8",
        token_number="IND-20261122-0004",
        customer_name="Rohan Verma",
        customer_phone="+91 98201 55432",
        mode=OrderMode.DINE_IN,
        status=OrderStatus.PREPARING,
        payment_status=PaymentStatus.PENDING,
        placed_by=PlacedBy.POS,
        subtotal=Decimal("810.00"),
        cgst=Decimal("40.50"),
        sgst=Decimal("40.50"),
        service_charge=Decimal("40.50"),
        discount=Decimal("0.00"),
        total_amount=Decimal("891.00")
    )
    db.add(ord_t4)
    db.flush()

    t4 = db.query(DiningTable).filter(DiningTable.id == "T-04").first()
    if t4:
        t4.current_order_id = ord_t4.id

    t4_items = [
        ("dish-01", "Butter Chicken (Boneless)", Decimal("340.00"), 1, DietaryType.NONVEG, StationType.CURRY),
        ("dish-04", "Garlic Butter Naan", Decimal("60.00"), 3, DietaryType.VEG, StationType.TANDOOR),
        ("dish-02", "Paneer Tikka Masala", Decimal("290.00"), 1, DietaryType.VEG, StationType.CURRY),
    ]
    for did, iname, iprice, iqty, idiet, istn in t4_items:
        oit = OrderItem(
            id=f"item-t4-{did[-2:]}",
            order_id=ord_t4.id,
            menu_item_id=did,
            name=iname,
            price=iprice,
            quantity=iqty,
            dietary=idiet,
            station=istn,
            status="cooking"
        )
        db.add(oit)

    kot_t4 = KOT(
        id="kot-1042",
        restaurant_id=rest.id,
        order_id=ord_t4.id,
        kot_number=1042,
        table_id="T-04",
        status=KOTStatus.COOKING,
        placed_by=PlacedBy.POS,
        captain_notes="Guest allergic to bell pepper; keep naan crisp"
    )
    db.add(kot_t4)
    db.flush()

    for did, iname, iprice, iqty, idiet, istn in t4_items:
        kit = KOTItem(
            id=f"ki-t4-{did[-2:]}",
            kot_id=kot_t4.id,
            dish_id=did,
            name=iname,
            quantity=iqty,
            dietary=idiet,
            station=istn,
            is_prepared=(did == "dish-02")
        )
        db.add(kit)

    # 9. Genuine Commercial Suppliers
    suppliers_data = [
        ("sup-01", "Gokul Dairy Mumbai", "Gokul Prasad", "+91 98201 11222", "gokul@dairy.in", "Dadar East, Mumbai", "27AABCG1234D1Z5"),
        ("sup-02", "Bandra Fresh Poultry", "Aslam Sheikh", "+91 98202 33444", "aslam@freshpoultry.in", "Bandra West, Mumbai", "27AABCS5678E1Z8"),
        ("sup-03", "Silver Wheat Mills", "Harish Shah", "+91 98203 55666", "harish@silvermills.in", "APMC Vashi, Navi Mumbai", "27AABCH9012F1Z1"),
        ("sup-04", "Amul B2B Distribution", "Kiran Patel", "+91 98204 77888", "amulb2b@distribution.in", "Kurla West, Mumbai", "27AABCA3456G1Z4"),
    ]
    for sid, sname, cperson, sphone, semail, saddr, sgst in suppliers_data:
        sup = Supplier(
            id=sid,
            restaurant_id=rest.id,
            name=sname,
            contact_person=cperson,
            phone=sphone,
            email=semail,
            address=saddr,
            gst_number=sgst,
            is_active=True
        )
        db.add(sup)

    db.commit()
