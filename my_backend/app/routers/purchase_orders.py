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
    Colour: Optional[str] = None
    Arrival_status: str = "ordered"
    Batch_created: bool = False
    Batch_code: Optional[str] = None
    Edit_count: int = 0

class PaymentSchema(BaseModel):
    paidAmount: float
    paidDate: Optional[str] = None
    notes: Optional[str] = None

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
    query = supabase.table("Purchase_orders").select("*, Vendor:Vendors(*), Items:Purchase_order_items(*), Payments:Payments(*)")
    
    # We can't easily filter by nested child property (Items.Category) in one Supabase call efficiently 
    # without Postgrest syntax that might be complex. 
    # Current frontend logic fetches ALL then filters in JS. We will do same in Python for safety/consistency.
    
    response = query.order("Created_at", desc=True).execute()
    data = response.data
    
    normalized = []
    for row in data:
        items = row.get("Items", [])
        payments = row.get("Payments", [])
        
        # Calculate totals
        total_amount = sum((float(it.get("Total_price") or 0)) for it in items)
        paid_amount = sum((float(p.get("Amount") or 0)) for p in payments)
        
        # Filter if category provided
        if category:
            cat_key = category.lower()
            # Check if ANY item in this order matches category
            has_cat = any((it.get("Category") or "").lower() == cat_key for it in items)
            if not has_cat:
                continue
        
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
            "PaidAmount": paid_amount
        })
        
    return normalized

@router.post("/")
def create_purchase_order(payload: OrderCreateSchema):
    try:
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
            
        # 2. Purchase Order
        po_data = {
            "Po_invoice_no": payload.poDetails.get("Po_invoice_no") or f"INV-{int(datetime.now().timestamp()*1000)}",
            "Po_date": payload.poDetails.get("Po_date"),
            "Notes": payload.poDetails.get("Notes"),
            "Vendor_id": vendor_id
        }
        po_res = supabase.table("Purchase_orders").insert(po_data).execute()
        if not po_res.data:
             raise HTTPException(status_code=500, detail="Failed to create Purchase Order")
        
        po_id = po_res.data[0]["Po_id"]
        
        # 3. Items
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
                "Colour": it.Colour,
                "Arrival_status": "ordered",
                "Batch_created": False,
                "Batch_code": None,
                "Edit_count": 0
            })
            
        if items_to_insert:
            supabase.table("Purchase_order_items").insert(items_to_insert).execute()
            
        # 4. Payment
        paid_val = 0
        total_val = sum(x["Total_price"] for x in items_to_insert)
        
        if payload.payment and payload.payment.paidAmount > 0:
            paid_val = payload.payment.paidAmount
            supabase.table("Payments").insert({
                "Po_id": po_id,
                "Amount": paid_val,
                "Payment_date": payload.payment.paidDate,
                "Notes": payload.payment.notes
            }).execute()
            
        # Update Status
        status = get_payment_status(paid_val, total_val)
        supabase.table("Purchase_orders").update({"Status": status}).eq("Po_id", po_id).execute()
        
        return {"success": True, "Po_id": po_id}
        
    except Exception as e:
        print("Create PO Error:", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{po_id}")
def update_purchase_order(po_id: int, payload: OrderUpdateSchema):
    try:
        # 1. Get existing order
        existing = supabase.table("Purchase_orders").select("*, Vendor(*), Items:Purchase_order_items(*)").eq("Po_id", po_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Order not found")
        
        ord_data = existing.data[0]
        
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
            
        # 3. Update PO Details
        supabase.table("Purchase_orders").update({
            "Po_invoice_no": payload.poDetails.get("Po_invoice_no"),
            "Po_date": payload.poDetails.get("Po_date"),
            "Notes": payload.poDetails.get("Notes")
        }).eq("Po_id", po_id).execute()
        
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
                
                # Check constraints
                if ex_item.get("Batch_created"):
                    # Check if critical fields changed
                    # (simplified logic here vs frontend)
                    pass
                
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
                    "Arrival_status": it.Arrival_status,
                    "Edit_count": edit_count
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
                    "Colour": it.Colour,
                    "Arrival_status": "ordered",
                    "Batch_created": False,
                    "Batch_code": None,
                    "Edit_count": 0
                }).execute()
                
        return {"success": True}
        
    except Exception as e:
        print("Update PO Error:", e)
        raise HTTPException(status_code=500, detail=str(e))

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
             
        # Insert
        supabase.table("Payments").insert({
            "Po_id": po_id,
            "Amount": payload.paidAmount,
            "Payment_date": payload.paidDate,
            "Notes": payload.notes
        }).execute()
        
        # Update Status
        new_paid = paid_so_far + payload.paidAmount
        status = get_payment_status(new_paid, total)
        supabase.table("Purchase_orders").update({"Status": status}).eq("Po_id", po_id).execute()
        
        return {"success": True}
        
    except Exception as e:
        print("Add Payment Error:", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{po_id}/mark_arrived")
def mark_all_arrived(po_id: int):
    # This duplicates frontend logic: 
    # 1. Generate QR (Batch/Products) 
    # 2. Mark Products Available 
    # 3. Mark Items Arrived
    # Note: QR Generation is COMPLEX. For now, we will do the DB updates.
    # We will SKIP image generation for now.
    
    try:
        # Fetch invoice no
        po_res = supabase.table("Purchase_orders").select("Po_invoice_no").eq("Po_id", po_id).single().execute()
        invoice_no = po_res.data["Po_invoice_no"]
        
        # Generate QR Logic (Simplified - DB Only)
        # TODO: Implement full QR generation logic here
        
        # Mark Products Available
        # First get all PO Items for this PO
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
            
        # 2. Get Products
        products = supabase.table("Products").select("Item_id, Barcode_short, Qr_image_url, Batch_code").in_("Po_item_id", ids).execute()
        return products.data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
