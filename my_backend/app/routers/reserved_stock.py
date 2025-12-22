from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from app.database import supabase
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/stock", tags=["Reserved Logic"])

class ReservedNoteSchema(BaseModel):
    notes: str

@router.get("/reserved")
def get_reserved_stocks(category: str):
    try:
        # 1. Fetch Reserved Rows
        reserved_res = supabase.table("Reserved_stocks").select("*").order("Created_at", desc=True).execute()
        reserved_rows = reserved_res.data or []
        
        if not reserved_rows:
            return []
            
        stock_ids = [r["Stock_id"] for r in reserved_rows]
        client_ids = [r["Client_id"] for r in reserved_rows if r.get("Client_id")]
        
        # 2. Fetch Products
        products_map = {}
        if stock_ids:
            prods_res = supabase.table("Products").select("*, Purchase_order_items(Colour)").in_("Stock_id", stock_ids).execute()
            if prods_res.data:
                products_map = {p["Stock_id"]: p for p in prods_res.data}
                
        # 3. Fetch Clients
        clients_map = {}
        if client_ids:
            clients_res = supabase.table("Clients").select("Client_id, Client_name").in_("Client_id", client_ids).execute()
            if clients_res.data:
                clients_map = {c["Client_id"]: c for c in clients_res.data}
                
        # 4. Filter and Merge
        active_cat = category.lower()
        results = []
        
        for r in reserved_rows:
            prod = products_map.get(r["Stock_id"], {})
            client = clients_map.get(r["Client_id"], {})
            
            p_cat = (prod.get("Category") or "").lower()
            if p_cat != active_cat:
                continue
                
            po_item = prod.get("Purchase_order_items")
            colour = "-"
            if po_item:
                if isinstance(po_item, list) and po_item:
                    colour = po_item[0].get("Colour") or "-"
                elif isinstance(po_item, dict):
                    colour = po_item.get("Colour") or "-"
            
            results.append({
                "reservedId": r["Reserved_id"],
                "stockId": r["Stock_id"],
                "itemId": prod.get("Item_id") or "-",
                "productName": prod.get("Product_name") or "-",
                "size": prod.get("Size") or "-",
                "colour": colour,
                "category": prod.get("Category") or "-",
                "batchCode": prod.get("Batch_code") or "-",
                "clientName": client.get("Client_name") or "-",
                "doNumber": r.get("Delivery_order_no") or "-",
                "reservedDate": (r.get("Created_at") or "")[:10],
                "status": prod.get("Status") or "-",
                "remarks": r.get("Notes") or ""
            })
            
        return results

    except Exception as e:
        print("Get Reserved Error:", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/reserved/{reserved_id}")
def update_reserved_note(reserved_id: int, payload: ReservedNoteSchema):
    try:
        supabase.table("Reserved_stocks").update({
            "Notes": payload.notes,
            "Updated_at": datetime.now().isoformat()
        }).eq("Reserved_id", reserved_id).execute()
        return {"success": True}
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

@router.post("/reserved/{stock_id}/clear")
def clear_reserved_sale(stock_id: str):
    try:
        # 1. Fetch Product
        p_res = supabase.table("Products").select("Status, Client_id, Delivery_order_no, Batch_id").eq("Stock_id", stock_id).single().execute()
        if not p_res.data:
             raise HTTPException(status_code=404, detail="Product not found")
        
        prod = p_res.data
        if prod["Status"] != "Out":
             return {"message": "Product is not Out, cannot clear reservation"}
             
        # 2. Update Product
        now_iso = datetime.now().isoformat()
        today_iso = datetime.now().date().isoformat()
        
        supabase.table("Products").update({
            "Status": "Sold",
            "Updated_at": now_iso
        }).eq("Stock_id", stock_id).execute()
        
        # 3. Delete Reserved
        supabase.table("Reserved_stocks").delete().eq("Stock_id", stock_id).execute()
        
        # 4. Update Batch Counts
        batch_id = prod.get("Batch_id")
        if batch_id:
            b_res = supabase.table("Stock_batches").select("*").eq("Batch_id", batch_id).single().execute()
            if b_res.data:
                batch = b_res.data
                out_val = batch.get("Out") or 0
                sold_val = batch.get("Sold") or 0
                returned_val = batch.get("Returned") or 0
                qty_val = batch.get("Batch_quantity") or 0
                
                out_val -= 1
                sold_val += 1
                
                available_val = qty_val - out_val - sold_val
                
                supabase.table("Stock_batches").update({
                    "Out": out_val,
                    "Sold": sold_val,
                    "Returned": returned_val,
                    "Available": available_val,
                    "Updated_at": now_iso
                }).eq("Batch_id", batch_id).execute()
                
        # 5. Log Movement
        supabase.table("Stock_movement").insert({
            "Stock_id": stock_id,
            "Movement_type": "Sold",
            "Client_id": prod.get("Client_id"),
            "Delivery_order_no": prod.get("Delivery_order_no"),
            "Scan_date": today_iso,
            "delivery_mode": "Reserved Clear",
            "undo_reason": None
        }).execute()
        
        return {"success": True}

    except Exception as e:
        print("Clear Reserved Error:", e)
        raise HTTPException(status_code=500, detail=str(e))
