from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Any
from app.database import supabase
from datetime import datetime

router = APIRouter(prefix="/scan", tags=["Scan & Delivery"])

# --- Schemas ---

class MarkOutSchema(BaseModel):
    stock_id: Any
    client_id: int
    do_no: str
    mode: str = "Scan" # "Single Scan", "Bulk Scan"

class ReturnSchema(BaseModel):
    stock_id: Any
    reason: str
    type: str # "before" or "after"

# --- Endpoints ---

@router.get("/barcode/{code:path}")
def lookup_barcode(code: str):
    clean = code.strip().upper()
    try:
        # 1. Try finding by Short Barcode
        res = supabase.table("Products").select("*, Purchase_order_items(Colour)").eq("Barcode_short", clean).single().execute()
        
        prod = res.data

        # 2. If not found, try finding by Item ID (exact match)
        if not prod:
            # We assume Item_id is also a string (or castable)
            res2 = supabase.table("Products").select("*, Purchase_order_items(Colour)").eq("Item_id", clean).single().execute()
            prod = res2.data

        if not prod:
            return None 
            
        # Flatten colour for convenience
        colour = "-"
        po_item = prod.get("Purchase_order_items")
        if po_item:
            if isinstance(po_item, list) and po_item:
                colour = po_item[0].get("Colour") or "-"
            elif isinstance(po_item, dict):
                colour = po_item.get("Colour") or "-"
                
        # Return enriched object
        prod["colour"] = colour
        return prod
        
    except Exception as e:
        print("Lookup error (first attempt might vary):", e)
        # It's possible the first .single() raised an exception because 0 rows were found.
        # We should probably catch that specific case or use a safer approach (limit 1).
        
        # Safer Fallback approach:
        try:
             # Try Item ID if the first one failed strictly due to "row not found" exception
             res2 = supabase.table("Products").select("*, Purchase_order_items(Colour)").eq("Item_id", clean).single().execute()
             if res2.data:
                prod = res2.data
                colour = "-"
                po_item = prod.get("Purchase_order_items")
                if po_item:
                    if isinstance(po_item, list) and po_item:
                        colour = po_item[0].get("Colour") or "-"
                    elif isinstance(po_item, dict):
                        colour = po_item.get("Colour") or "-"
                prod["colour"] = colour
                return prod
        except:
            pass
            
        return None

@router.post("/mark_out")
def mark_out_item(payload: MarkOutSchema):
    try:
        # 1. Check current status
        p_res = supabase.table("Products").select("Status, Batch_id").eq("Stock_id", payload.stock_id).single().execute()
        if not p_res.data:
            raise HTTPException(status_code=404, detail="Product not found")
        
        prod = p_res.data
        if prod["Status"] in ["Out", "Sold"]:
            raise HTTPException(status_code=400, detail=f"Product is already {prod['Status']}")
            
        now_iso = datetime.now().isoformat()
        today_iso = datetime.now().date().isoformat()

        # 2. Update Product
        supabase.table("Products").update({
            "Status": "Out",
            "Client_id": payload.client_id,
            "Delivery_order_no": payload.do_no,
            "Updated_at": now_iso
        }).eq("Stock_id", payload.stock_id).execute()
        
        # 3. Insert Reserved
        # Note: In the old code, it inserts Client_id/DO into Reserved_stocks too.
        supabase.table("Reserved_stocks").insert({
            "Stock_id": payload.stock_id,
            "Client_id": payload.client_id,
            "Delivery_order_no": payload.do_no
        }).execute()
        
        # 4. Update Batch Counts (Out++)
        batch_id = prod.get("Batch_id")
        if batch_id:
            b_res = supabase.table("Stock_batches").select("*").eq("Batch_id", batch_id).single().execute()
            if b_res.data:
                batch = b_res.data
                out_val = batch.get("Out") or 0
                sold_val = batch.get("Sold") or 0
                qty = batch.get("Batch_quantity") or 0
                
                out_val += 1
                avail = qty - out_val - sold_val
                
                supabase.table("Stock_batches").update({
                    "Out": out_val,
                    "Available": avail,
                    "Updated_at": now_iso
                }).eq("Batch_id", batch_id).execute()
        
        # 5. Log Movement
        supabase.table("Stock_movement").insert({
            "Stock_id": payload.stock_id,
            "Movement_type": "Out",
            "Client_id": payload.client_id,
            "Delivery_order_no": payload.do_no,
            "Scan_date": today_iso,
            "delivery_mode": payload.mode
        }).execute()
        
        return {"success": True}
        
    except Exception as e:
        print("Mark Out Error:", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/return")
def return_item(payload: ReturnSchema):
    try:
        # 1. Fetch details for Logging (We need Client/DO/Name etc BEFORE clearing)
        p_res = supabase.table("Products").select("""
            Stock_id, Item_id, Product_name, Size, Batch_code, 
            Client_id, Delivery_order_no, Batch_id, Status,
            Clients ( Client_name ),
            Purchase_order_items ( Colour )
        """).eq("Stock_id", payload.stock_id).single().execute()
        
        if not p_res.data:
            raise HTTPException(status_code=404, detail="Product not found")
            
        prod = p_res.data
        old_status = prod.get("Status")
        
        # Validation
        if payload.type == "before" and old_status != "Out":
             raise HTTPException(status_code=400, detail="Product is not Out")
        if payload.type == "after" and old_status != "Sold":
             raise HTTPException(status_code=400, detail="Product is not Sold")
             
        # Prepare Return List Payload
        colour = "-"
        po_item = prod.get("Purchase_order_items")
        if po_item:
            if isinstance(po_item, list) and po_item:
                colour = po_item[0].get("Colour") or "-"
            elif isinstance(po_item, dict):
                colour = po_item.get("Colour") or "-"
                
        client_name = "-"
        if prod.get("Clients"):
            client_name = prod["Clients"].get("Client_name") or "-"
            
        tag = "Return Before Invoice" if payload.type == "before" else "Return After Sale"

        return_entry = {
            "stock_id": prod["Stock_id"],
            "item_ids": [prod["Item_id"]],
            "product_name": prod["Product_name"],
            "size": prod["Size"],
            "batch_code": prod["Batch_code"],
            "client_id": prod["Client_id"],
            "client_name": client_name,
            "do_number": prod["Delivery_order_no"],
            "reason": f"{payload.reason} | {tag}",
            "is_bulk": False,
            "colour": colour,
            "return_date": datetime.now().date().isoformat()
        }

        
        # 2. Add to Return List
        supabase.table("Return_list").insert(return_entry).execute()
        
        # 3. Update Product -> Available
        now_iso = datetime.now().isoformat()
        supabase.table("Products").update({
            "Status": "Available",
            "Client_id": None,
            "Delivery_order_no": None,
            "Updated_at": now_iso
        }).eq("Stock_id", payload.stock_id).execute()
        
        # 4. Delete from Reserved (if exists)
        supabase.table("Reserved_stocks").delete().eq("Stock_id", payload.stock_id).execute()
        
        # 5. Update Batch Counts
        batch_id = prod.get("Batch_id")
        if batch_id:
            b_res = supabase.table("Stock_batches").select("*").eq("Batch_id", batch_id).single().execute()
            if b_res.data:
                batch = b_res.data
                out_val = batch.get("Out") or 0
                sold_val = batch.get("Sold") or 0
                returned_val = batch.get("Returned") or 0
                qty = batch.get("Batch_quantity") or 0
                
                if payload.type == "before": 
                    # Out - 1, Returned + 1
                    out_val -= 1
                    returned_val += 1
                elif payload.type == "after":
                    # Sold - 1, Returned + 1
                    sold_val -= 1
                    returned_val += 1
                    
                avail = qty - out_val - sold_val
                
                supabase.table("Stock_batches").update({
                    "Out": out_val,
                    "Sold": sold_val,
                    "Returned": returned_val,
                    "Available": avail,
                    "Updated_at": now_iso
                }).eq("Batch_id", batch_id).execute()

        # 6. Log Movement
        tag = "Return Before Invoice" if payload.type == "before" else "Return After Sale"
        supabase.table("Stock_movement").insert({
            "Stock_id": payload.stock_id,
            "Movement_type": tag,
            "Client_id": prod["Client_id"], # Log the client it came from
            "Delivery_order_no": prod["Delivery_order_no"],
            "Scan_date": datetime.now().date().isoformat(),
            "undo_reason": payload.reason
        }).execute()

        return {"success": True}
        
    except Exception as e:
        print("Return Error:", e)
        raise HTTPException(status_code=500, detail=str(e))
# --- New Schema for Undo ---
class UndoSaleSchema(BaseModel):
    stock_id: str
    reason: str

@router.get("/deliveries")
def get_delivery_list():
    try:
        # Fetch products marked Out or Sold
        # We need client name and colour as well
        res = supabase.table("Products").select("""
            Stock_id, Item_id, Product_name, Size, Batch_code, Category, Status, 
            Client_id, Delivery_order_no, Created_at, Updated_at,
            Clients!Products_Client_id_fkey ( Client_name ),
            Purchase_order_items!Products_Po_item_id_fkey ( Colour )
        """).in_("Status", ["Out", "Sold"]).execute()
        
        if not res.data:
            return []
            
        raw_data = res.data
        
        # Group by DO
        groups = {}
        for row in raw_data:
            do_no = row.get("Delivery_order_no")
            if not do_no:
                continue
                
            if do_no not in groups:
                client_name = "-"
                if row.get("Clients"):
                     client_name = row["Clients"].get("Client_name") or "-"
                
                # Use Updated_at or Created_at for date
                date_str = (row.get("Updated_at") or row.get("Created_at") or "")[:10]
                
                groups[do_no] = {
                    "do": do_no,
                    "client": client_name,
                    "date": date_str,
                    "items": []
                }
            
            # Extract Colour
            colour = "-"
            po_item = row.get("Purchase_order_items")
            if po_item:
                if isinstance(po_item, list) and po_item:
                    colour = po_item[0].get("Colour") or "-"
                elif isinstance(po_item, dict):
                    colour = po_item.get("Colour") or "-"
            
            groups[do_no]["items"].append({
                "stockId": row["Stock_id"],
                "itemId": row["Item_id"],
                "category": row.get("Category"),
                "product": row.get("Product_name"),
                "size": row.get("Size"),
                "colour": colour,
                "batch": row.get("Batch_code"),
                "status": row.get("Status"),
                "clientId": row.get("Client_id")
            })
            
        return list(groups.values())

    except Exception as e:
        print("Get Deliveries Error:", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/undo")
def undo_sale(payload: UndoSaleSchema):
    try:
        # 1. Fetch Product
        p_res = supabase.table("Products").select("Status, Client_id, Delivery_order_no, Batch_id").eq("Stock_id", payload.stock_id).single().execute()
        if not p_res.data:
             raise HTTPException(status_code=404, detail="Product not found")
        
        prod = p_res.data
        if prod["Status"] != "Sold":
             raise HTTPException(status_code=400, detail="Product is not Sold")
             
        now_iso = datetime.now().isoformat()
        
        # 2. Update Product -> Out (Revert Sale)
        supabase.table("Products").update({
            "Status": "Out",
            "Updated_at": now_iso
        }).eq("Stock_id", payload.stock_id).execute()
        
        # 3. Re-insert into Reserved Stocks
        # Because we are moving back to OUT (Reserved), we need an entry here.
        supabase.table("Reserved_stocks").insert({
            "Stock_id": payload.stock_id,
            "Client_id": prod["Client_id"],
            "Delivery_order_no": prod["Delivery_order_no"]
        }).execute()
        
        # 4. Update Batch Counts
        # Logic: Sold--, Out++
        batch_id = prod.get("Batch_id")
        if batch_id:
            b_res = supabase.table("Stock_batches").select("*").eq("Batch_id", batch_id).single().execute()
            if b_res.data:
                batch = b_res.data
                out_val = batch.get("Out") or 0
                sold_val = batch.get("Sold") or 0
                # available stays same because it's just moving buckets
                
                out_val += 1
                sold_val -= 1
                
                supabase.table("Stock_batches").update({
                    "Out": out_val,
                    "Sold": sold_val,
                    "Updated_at": now_iso
                }).eq("Batch_id", batch_id).execute()
                
        # 5. Log Movement
        supabase.table("Stock_movement").insert({
            "Stock_id": payload.stock_id,
            "Movement_type": "Undo Sale",
            "Client_id": prod["Client_id"],
            "Delivery_order_no": prod["Delivery_order_no"],
            "Scan_date": datetime.now().date().isoformat(),
            "undo_reason": payload.reason
        }).execute()
        
        return {"success": True}

    except Exception as e:
        print("Undo Sale Error:", e)
        raise HTTPException(status_code=500, detail=str(e))
