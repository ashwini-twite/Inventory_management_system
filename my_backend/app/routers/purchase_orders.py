from fastapi import APIRouter, HTTPException, Body
from typing import List, Optional, Any, Dict
from pydantic import BaseModel
from datetime import datetime, date
from app.database import supabase
import math

router = APIRouter(prefix="/purchase_orders", tags=["Purchase Orders"])

# --- Pydantic Models ---

class VendorSchema(BaseModel):
    Vendor_name: str
    Address_line: Optional[str] = None
    Address_location: Optional[str] = None
    Address_city: Optional[str] = None
    Address_state: Optional[str] = None
    Postal_code: Optional[str] = None
    Country: Optional[str] = None
    Vat_number: Optional[str] = None

class ItemSchema(BaseModel):
    Po_item_id: Optional[int] = None
    Item_name: str
    Category: str
    Quantity_ordered: int
    Unit_price: float
    Total_price: float
    Height: Optional[str] = None
    Width: Optional[str] = None
    Thickness: Optional[str] = None
    Sqmt: Optional[str] = None
    sqmt: Optional[str] = None
    Colour: Optional[str] = None
    Arrival_status: str = "ordered"
    Batch_created: bool = False
    Batch_code: Optional[str] = None
    Edit_count: int = 0

class PaymentSchema(BaseModel):
    paidAmount: float
    paidDate: Optional[str] = None
    notes: Optional[str] = None
    currency: Optional[str] = None

class OrderCreateSchema(BaseModel):
    vendor: VendorSchema
    poDetails: Dict[str, Any]  # Po_invoice_no, Po_date, etc.
    items: List[ItemSchema]
    payment: Optional[PaymentSchema] = None

class OrderUpdateSchema(BaseModel):
    vendor: VendorSchema
    poDetails: Dict[str, Any]
    items: List[ItemSchema]

# --- Helpers ---

def get_payment_status(paid: float, total: float) -> str:
    if total <= 0 or paid <= 0:
        return "Unpaid"
    if paid < total:
        return "Partial Paid"
    if abs(paid - total) < 0.01:
        return "Full Paid"
    return "Unpaid"  # Should typically be Covered by Logic above

# --- Endpoints ---

@router.get("/list")
def list_purchase_orders(category: Optional[str] = None):
    # Fetch POs with nested relations
    query = supabase.table("Purchase_orders").select("*, Vendor:Vendors(*), Items:Purchase_order_items(*), Payments:Payments(*), Charges:purchase_order_charges(*)")
    
    response = query.order("Created_at", desc=True).execute()
    data = response.data
    
    normalized = []
    for row in data:
        items = row.get("Items", [])
        payments = row.get("Payments", [])
        charges = row.get("Charges", [])
        
        # Calculate totals
        total_amount = sum((float(it.get("Total_price") or 0)) for it in items)
        paid_amount = sum((float(p.get("Amount") or 0)) for p in payments)
        
        # Filter if category provided
        if category:
            cat_key = category.lower()
            has_cat = any((it.get("Category") or "").lower() == cat_key for it in items)
            if not has_cat:
                continue
        
        # Map charges back to top-level for frontend compatibility
        charge_map = {c["charge_type"]: c["amount"] for c in charges}
        
        normalized.append({
            "Po_id": row["Po_id"],
            "Po_invoice_no": row["Po_invoice_no"],
            "Po_date": row["Po_date"],
            "Notes": row["Notes"],
            "Status": row["Status"],
            "Created_at": row["Created_at"],
            "Vendor": row["Vendor"],
            "Items": items,
            "Payments": payments,
            "TotalAmount": total_amount,
            "PaidAmount": paid_amount,
            "currency": row.get("currency", "INR"),
            "Total_sqmt": row.get("Total_sqmt"),
            "Landing_cost": row.get("Landing_cost"),
            # Flattened charges for FE compatibility
            "Ocean_freight": charge_map.get("Ocean Freight", 0),
            "Insurance": charge_map.get("Insurance", 0),
            "Fumigation": charge_map.get("Fumigation", 0),
            "Clearance": charge_map.get("Clearance", 0)
        })
        
    return normalized

@router.get("/stats")
def get_po_stats():
    try:
        # Fetch all POs with their items
        res = supabase.table("Purchase_orders").select("Po_id, Items:Purchase_order_items(Category, Arrival_status)").execute()
        orders = res.data or []
        
        categories = ["granite", "quartz", "monuments"]
        stats = {cat: {"total": 0, "pending": 0, "completed": 0} for cat in categories}
        
        for order in orders:
            items = order.get("Items", [])
            # Categorize items in this order
            order_cats = set((it.get("Category") or "").lower() for it in items)
            
            for cat in categories:
                cat_items = [it for it in items if (it.get("Category") or "").lower() == cat]
                if not cat_items:
                    continue
                
                # If this order contains items of this category, it counts towards Total
                stats[cat]["total"] += 1
                
                # Check status specifically for items in this category within this order
                is_completed = all(it.get("Arrival_status") == "Arrived" for it in cat_items)
                
                if is_completed:
                    stats[cat]["completed"] += 1
                else:
                    stats[cat]["pending"] += 1
                    
        return stats
    except Exception as e:
        print("PO Stats Error:", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def create_purchase_order(payload: OrderCreateSchema):
    try:
        print("PO currency received:", payload.poDetails.get("currency")) 
        # 1. Vendor
        vendor_name = payload.vendor.Vendor_name.strip()
        vendor_id = None
        
        if vendor_name:
            # Check existing
            v_res = supabase.table("Vendors").select("*").ilike("Vendor_name", vendor_name).limit(1).execute()
            if v_res.data:
                vendor_id = v_res.data[0]["Vendor_id"]
            else:
                # Create new
                new_v = supabase.table("Vendors").insert({
                    "Vendor_name": vendor_name,
                    "Address_line": payload.vendor.Address_line or "",
                    "Address_location": payload.vendor.Address_location or "",
                    "Address_city": payload.vendor.Address_city or "",
                    "Address_state": payload.vendor.Address_state or "",
                    "Postal_code": payload.vendor.Postal_code or "",
                    "Country": payload.vendor.Country or "",
                    "Vat_number": payload.vendor.Vat_number or ""
                }).execute()
                if new_v.data:
                    vendor_id = new_v.data[0]["Vendor_id"]
        
        if not vendor_id:
            raise HTTPException(status_code=400, detail="Vendor ID could not be determined")
            
        # 2. Purchase Order (Duplicate Invoice Check)
        invoice_no = payload.poDetails.get("Po_invoice_no")
        if not invoice_no:
            invoice_no = f"INV-{int(datetime.now().timestamp()*1000)}"
        else:
            # Check for existing
            existing_po = supabase.table("Purchase_orders").select("Po_id").eq("Po_invoice_no", invoice_no).execute()
            if existing_po.data:
                raise HTTPException(
                    status_code=400, 
                    detail="this invoice number already exist ..enter correct invoice number"
                )
            
        po_data = {
            "Po_invoice_no": invoice_no,
            "Po_date": payload.poDetails.get("Po_date"),
            "Notes": payload.poDetails.get("Notes"),
            "Vendor_id": vendor_id,
            "currency": payload.poDetails.get("currency", "INR"),
            "Total_sqmt": payload.poDetails.get("Total_sqmt"),
            "Landing_cost": payload.poDetails.get("Landing_cost"),
        }
        po_res = supabase.table("Purchase_orders").insert(po_data).execute()
        if not po_res.data:
             print("PO Insert Error Detail:", po_res)
             raise HTTPException(status_code=500, detail="Failed to create Purchase Order - likely database constraint or connection issue.")
        po_id = po_res.data[0]["Po_id"]

        # 2b. Charges (Sync: Delete existing and re-insert)
        supabase.table("purchase_order_charges").delete().eq("po_id", po_id).execute()
        
        currency = payload.poDetails.get("currency", "INR")
        charges_data = [
            {"po_id": po_id, "charge_type": "Ocean Freight", "amount": payload.poDetails.get("Ocean_freight") or 0, "currency": currency},
            {"po_id": po_id, "charge_type": "Insurance", "amount": payload.poDetails.get("Insurance") or 0, "currency": currency},
            {"po_id": po_id, "charge_type": "Fumigation", "amount": payload.poDetails.get("Fumigation") or 0, "currency": currency},
            {"po_id": po_id, "charge_type": "Clearance", "amount": payload.poDetails.get("Clearance") or 0, "currency": currency},
        ]
        supabase.table("purchase_order_charges").insert(charges_data).execute()
        
        # 3. Items (Sync: Delete and re-insert if no batches created)
        existing_items = supabase.table("Purchase_order_items").select("Batch_created").eq("Po_id", po_id).execute()
        can_clean_items = not any(it.get("Batch_created") for it in existing_items.data)
        
        if can_clean_items:
            supabase.table("Purchase_order_items").delete().eq("Po_id", po_id).execute()
            
            items_to_insert = []
            for it in payload.items:
                items_to_insert.append({
                    "Po_id": po_id,
                    "Item_name": it.Item_name,
                    "Category": it.Category,
                    "Quantity_ordered": it.Quantity_ordered,
                    "Unit_price": it.Unit_price,
                    "Total_price": it.Total_price,
                    "Height": it.Height,
                    "Width": it.Width,
                    "Thickness": it.Thickness,
                    "sqmt": it.Sqmt or (it.sqmt if hasattr(it, 'sqmt') else None),
                    "Colour": it.Colour,
                    "Arrival_status": "ordered",
                    "Batch_created": False,
                    "Batch_code": None,
                    "Edit_count": 0,
                    "currency": payload.poDetails.get("currency")
                })
                
            if items_to_insert:
                supabase.table("Purchase_order_items").insert(items_to_insert).execute()
        
        # 4. Payment (Prevent duplicates on retry)
        paid_val = 0
        items_total = sum(float(x.Total_price or 0) for x in payload.items)
        charges_total = sum(float(x["amount"]) for x in charges_data)
        grand_total = items_total + charges_total
        
        if payload.payment and payload.payment.paidAmount > 0:
            paid_val = payload.payment.paidAmount
            # Check for existing identical payment
            existing_pmt = supabase.table("Payments") \
                .select("*") \
                .eq("Po_id", po_id) \
                .eq("Amount", paid_val) \
                .eq("Payment_date", payload.payment.paidDate) \
                .execute()
            
            if not existing_pmt.data:
                supabase.table("Payments").insert({
                    "Po_id": po_id,
                    "Amount": paid_val,
                    "Payment_date": payload.payment.paidDate,
                    "Notes": payload.payment.notes,
                    "currency": payload.payment.currency or payload.poDetails.get("currency", "INR")
                }).execute()
            else:
                print("Payment already exists, skipping insert.")
            
        # Re-calculate paid_amount (since there might be other payments)
        all_pmts = supabase.table("Payments").select("Amount").eq("Po_id", po_id).execute()
        total_paid_so_far = sum(float(p["Amount"] or 0) for p in all_pmts.data)
            
        # Update Status
        status = get_payment_status(total_paid_so_far, grand_total)
        supabase.table("Purchase_orders").update({"Status": status}).eq("Po_id", po_id).execute()
        
        return {"success": True, "Po_id": po_id}
        
    except Exception as e:
        import traceback
        print("Create PO Error:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server application error: {str(e)}")

@router.put("/{po_id}")
def update_purchase_order(po_id: int, payload: OrderUpdateSchema):
    try:
        # 1. Get existing order
        existing = supabase.table("Purchase_orders").select("*, Vendors(*), Items:Purchase_order_items(*)").eq("Po_id", po_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Order not found")
        
        ord_data = existing.data[0]
        existing_payments = supabase.table("Payments") \
            .select("Payment_id") \
            .eq("Po_id", po_id) \
            .execute()

        if existing_payments.data and payload.poDetails.get("currency"):
            # Simple check, if currency is different
            if payload.poDetails.get("currency") != ord_data.get("currency"):
                raise HTTPException(
                    status_code=400,
                    detail="Cannot change currency after payments exist"
                )

        # 2. Update Vendor
        vendor_id = ord_data.get("Vendor_id")
        if vendor_id and payload.vendor:
            supabase.table("Vendors").update({
                "Vendor_name": payload.vendor.Vendor_name,
                "Address_line": payload.vendor.Address_line,
                "Address_location": payload.vendor.Address_location,
                "Address_city": payload.vendor.Address_city,
                "Address_state": payload.vendor.Address_state,
                "Postal_code": payload.vendor.Postal_code,
                "Country": payload.vendor.Country,
                "Vat_number": payload.vendor.Vat_number
            }).eq("Vendor_id", vendor_id).execute()
            
        # 3. Update PO Details (Primary totals and basic info)
        supabase.table("Purchase_orders").update({
            "Po_invoice_no": payload.poDetails.get("Po_invoice_no"),
            "Po_date": payload.poDetails.get("Po_date"),
            "Notes": payload.poDetails.get("Notes"),
            "Total_sqmt": payload.poDetails.get("Total_sqmt"),
            "Landing_cost": payload.poDetails.get("Landing_cost"),
        }).eq("Po_id", po_id).execute()

        # 3b. Sync Charges
        supabase.table("purchase_order_charges").delete().eq("po_id", po_id).execute()
        
        currency = ord_data.get("currency", "INR")
        charges_data = [
            {"po_id": po_id, "charge_type": "Ocean Freight", "amount": payload.poDetails.get("Ocean_freight") or 0, "currency": currency},
            {"po_id": po_id, "charge_type": "Insurance", "amount": payload.poDetails.get("Insurance") or 0, "currency": currency},
            {"po_id": po_id, "charge_type": "Fumigation", "amount": payload.poDetails.get("Fumigation") or 0, "currency": currency},
            {"po_id": po_id, "charge_type": "Clearance", "amount": payload.poDetails.get("Clearance") or 0, "currency": currency},
        ]
        supabase.table("purchase_order_charges").insert(charges_data).execute()
        
        # 4. Sync Items
        existing_items = ord_data.get("Items", [])
        existing_map = {item["Po_item_id"]: item for item in existing_items}
        
        incoming_ids = [it.Po_item_id for it in payload.items if it.Po_item_id]
        
        # Delete removed
        for ex_id, ex_item in existing_map.items():
            if ex_id not in incoming_ids:
                if ex_item.get("Batch_created"):
                    raise HTTPException(status_code=400, detail=f"Cannot delete item {ex_item.get('Item_name')} because batch created.")
                supabase.table("Purchase_order_items").delete().eq("Po_item_id", ex_id).execute()
                
        # Upsert
        for it in payload.items:
            if it.Po_item_id:
                # Update
                ex_item = existing_map.get(it.Po_item_id)
                if not ex_item: continue
                
                edit_count = ex_item.get("Edit_count", 0) + 1 if ex_item.get("Batch_created") else 0
                
                supabase.table("Purchase_order_items").update({
                    "Item_name": it.Item_name,
                    "Quantity_ordered": it.Quantity_ordered,
                    "Unit_price": it.Unit_price,
                    "Total_price": it.Total_price,
                    "Colour": it.Colour,
                    "Height": it.Height,
                    "Width": it.Width,
                    "Thickness": it.Thickness,
                    "sqmt": it.Sqmt or (it.sqmt if hasattr(it, 'sqmt') else None),
                    "Arrival_status": it.Arrival_status,
                    "Edit_count": edit_count,
                    "currency": ord_data.get("currency", "INR")
                }).eq("Po_item_id", it.Po_item_id).execute()
            else:
                # Insert
                supabase.table("Purchase_order_items").insert({
                    "Po_id": po_id,
                    "Item_name": it.Item_name,
                    "Category": it.Category,
                    "Quantity_ordered": it.Quantity_ordered,
                    "Unit_price": it.Unit_price,
                    "Total_price": it.Total_price,
                    "Height": it.Height,
                    "Width": it.Width,
                    "Thickness": it.Thickness,
                    "sqmt": it.Sqmt or it.sqmt if hasattr(it, 'sqmt') else it.Sqmt,
                    "Colour": it.Colour,
                    "Arrival_status": "ordered",
                    "Batch_created": False,
                    "Batch_code": None,
                    "Edit_count": 0,
                    "currency": ord_data.get("currency", "INR")
                }).execute()
                
        return {"success": True}
        
    except Exception as e:
        import traceback
        print("Update PO Error:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")

@router.post("/{po_id}/payments")
def add_payment(po_id: int, payload: PaymentSchema):
    try:
        # Check totals
        po_res = supabase.table("Purchase_orders").select("*, Items:Purchase_order_items(Total_price), Payments(Amount)").eq("Po_id", po_id).single().execute()
        if not po_res.data:
            raise HTTPException(status_code=404, detail="Order not found")
        
        order = po_res.data
        items = order.get("Items", [])
        payments = order.get("Payments", [])
        
        total = sum(i.get("Total_price") or 0 for i in items)
        paid_so_far = sum(p.get("Amount") or 0 for p in payments)
        
        if paid_so_far + payload.paidAmount > total:
             raise HTTPException(status_code=400, detail=f"Payment exceeds total. Total: {total}, Paid: {paid_so_far}")
             
        # Prevent multiple identical payments
        existing_pmt = supabase.table("Payments") \
            .select("*") \
            .eq("Po_id", po_id) \
            .eq("Amount", payload.paidAmount) \
            .eq("Payment_date", payload.paidDate) \
            .execute()
        
        if not existing_pmt.data:
            # Insert
            supabase.table("Payments").insert({
                "Po_id": po_id,
                "Amount": payload.paidAmount,
                "Payment_date": payload.paidDate,
                "Notes": payload.notes,
                "currency": payload.currency or order.get("currency", "INR")
            }).execute()
        else:
             print("Payment already exists in add_payment, skipping.")
        
        # Update Status
        all_pmts = supabase.table("Payments").select("Amount").eq("Po_id", po_id).execute()
        new_paid = sum(float(p["Amount"] or 0) for p in all_pmts.data)
        status = get_payment_status(new_paid, total)
        supabase.table("Purchase_orders").update({"Status": status}).eq("Po_id", po_id).execute()
        
        return {"success": True}
        
    except Exception as e:
        import traceback
        print("Add Payment Error:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Add payment failed: {str(e)}")

@router.post("/{po_id}/mark_arrived")
def mark_all_arrived(po_id: int):
    try:
        # Fetch invoice no
        po_res = supabase.table("Purchase_orders").select("Po_invoice_no").eq("Po_id", po_id).single().execute()
        invoice_no = po_res.data["Po_invoice_no"]
        
        # Mark Products Available
        items_res = supabase.table("Purchase_order_items").select("Po_item_id").eq("Po_id", po_id).execute()
        po_item_ids = [x["Po_item_id"] for x in items_res.data]
        
        if po_item_ids:
            supabase.table("Products").update({"Status": "Available"}).in_("Po_item_id", po_item_ids).execute()
        
        # Mark Items Arrived
        supabase.table("Purchase_order_items").update({"Arrival_status": "Arrived"}).eq("Po_id", po_id).execute()
        
        return {"success": True, "message": "Arrived successfully (Limited QR logic)"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{po_id}/products")
def get_po_products(po_id: int):
    # Fetch products linked to this PO via Purchase_order_items
    try:
        # 1. Get Po_item_ids
        items = supabase.table("Purchase_order_items").select("Po_item_id").eq("Po_id", po_id).execute()
        ids = [x["Po_item_id"] for x in items.data]
        
        if not ids:
            return []
            
        # 2. Get Products with metadata
        products = supabase.table("Products") \
            .select("Item_id, Barcode_short, Qr_image_url, Batch_code, Product_name, Size, Purchase_order_items(Colour)") \
            .in_("Po_item_id", ids) \
            .execute()
        return products.data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
