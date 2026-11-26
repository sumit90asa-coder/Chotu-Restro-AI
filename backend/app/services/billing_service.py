from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import List, Dict, Any, Tuple, Optional
import math
from app.models.restaurant import Restaurant

def round_money(val: Decimal) -> Decimal:
    if val is None or not isinstance(val, Decimal):
        val = Decimal(str(val or 0))
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

class BillingService:
    @staticmethod
    def calculate_totals(
        items: List[Dict[str, Any]],
        restaurant: Optional[Restaurant],
        discount_amount: Decimal = Decimal("0.00")
    ) -> Tuple[Decimal, Decimal, Decimal, Decimal, Decimal, Decimal]:
        """
        Authoritative financial calculator for restaurant bills.
        Validates all items and prices:
        - Rejects NULL, NaN, infinity, negative prices, and invalid quantities.
        - Calculates Subtotal = Sum of (quantity * valid unit price).
        - Applies discount.
        - Computes CGST, SGST, and service charge from configured restaurant settings.
        - Returns (subtotal, cgst, sgst, service_charge, discount, grand_total).
        """
        subtotal = Decimal("0.00")
        for it in items:
            raw_price = it.get("price")
            raw_qty = it.get("quantity")

            if raw_price is None or raw_qty is None:
                raise ValueError("Item price and quantity cannot be null")

            try:
                price = Decimal(str(raw_price))
                qty = Decimal(str(raw_qty))
            except (InvalidOperation, TypeError, ValueError):
                raise ValueError(f"Invalid monetary format for item: price={raw_price}, qty={raw_qty}")

            if price.is_nan() or price.is_infinite() or price < Decimal("0.00"):
                raise ValueError(f"Invalid price {price}. Price cannot be NaN, infinite, or negative.")

            if qty.is_nan() or qty.is_infinite() or qty <= Decimal("0.00"):
                raise ValueError(f"Invalid quantity {qty}. Quantity must be strictly positive.")

            subtotal += price * qty
        
        subtotal = round_money(subtotal)

        # Validate discount
        try:
            discount = round_money(Decimal(str(discount_amount or 0)))
        except (InvalidOperation, TypeError, ValueError):
            discount = Decimal("0.00")

        if discount < Decimal("0.00") or discount.is_nan() or discount.is_infinite():
            discount = Decimal("0.00")

        # Clamp discount to subtotal
        discount = min(subtotal, discount)
        discounted_subtotal = max(Decimal("0.00"), subtotal - discount)

        # Tax & Service Charge configuration from restaurant
        if restaurant is not None:
            cgst_pct = getattr(restaurant, "cgst_percent", Decimal("2.50")) or Decimal("2.50")
            sgst_pct = getattr(restaurant, "sgst_percent", Decimal("2.50")) or Decimal("2.50")
            sc_pct = getattr(restaurant, "service_charge_percent", Decimal("5.00")) or Decimal("5.00")
        else:
            cgst_pct = Decimal("2.50")
            sgst_pct = Decimal("2.50")
            sc_pct = Decimal("5.00")

        cgst_rate = Decimal(str(cgst_pct)) / Decimal("100.0")
        sgst_rate = Decimal(str(sgst_pct)) / Decimal("100.0")
        sc_rate = Decimal(str(sc_pct)) / Decimal("100.0")

        cgst = round_money(discounted_subtotal * cgst_rate)
        sgst = round_money(discounted_subtotal * sgst_rate)
        service_charge = round_money(discounted_subtotal * sc_rate)

        grand_total = round_money(discounted_subtotal + cgst + sgst + service_charge)
        return subtotal, cgst, sgst, service_charge, discount, grand_total
