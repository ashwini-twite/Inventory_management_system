from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from app.database import supabase

router = APIRouter(prefix="/stock", tags=["Stock Counts"])

@router.get("/counts")
def get_stock_counts(category: str):
    try:
        # 1. Fetch all Batches
        batches_res = supabase.table("Stock_batches").select("*").execute()
        if not batches_res.data:
            return []
            
        batches = batches_res.data
        # batch_map = {b["Batch_id"]: b for b in batches} # Unused
        batch_ids = [b["Batch_id"] for b in batches]
        
        # 2. Fetch all PO Items
        po_items_res = supabase.table("Purchase_order_items").select("Po_item_id, Item_name, Category, Colour").execute()
        po_item_map = {p["Po_item_id"]: p for p in po_items_res.data}
        
        # 3. Filter Batches by Category
        active_cat = category.lower()
        relevant_batches = []
        relevant_batch_ids = []
        
        for b in batches:
            po = po_item_map.get(b["Po_item_id"])
            if not po: continue
            
            po_cat = (po.get("Category") or "").lower()
            if po_cat == active_cat:
                relevant_batches.append(b)
                relevant_batch_ids.append(b["Batch_id"])
                
        if not relevant_batches:
            return []

        # 4. Fetch Products for these batches
        products_res = supabase.table("Products").select("""
            Stock_id, Item_id, Status, Size, Category, Batch_id,
            Purchase_order_items ( Colour )
        """).in_("Batch_id", relevant_batch_ids).execute()
        
        all_products = products_res.data
        
        # Group products by Batch_id
        products_by_batch: Dict[int, List[Any]] = {bid: [] for bid in relevant_batch_ids}
        for p in all_products:
            bid = p.get("Batch_id")
            if bid in products_by_batch:
                products_by_batch[bid].append(p)
                
        # 5. Construct Response
        results = []
        for batch in relevant_batches:
            po = po_item_map.get(batch["Po_item_id"])
            items = products_by_batch.get(batch["Batch_id"], [])
            
            # Filter out if all items are QR Generated (frontend logic parity)
            if items:
                all_qr = all(it.get("Status") == "QR Generated" for it in items)
                if all_qr and len(items) > 0:
                    continue
            
            qty = batch.get("Batch_quantity") or len(items)
            out = batch.get("Out") or 0
            sold = batch.get("Sold") or 0
            returned = batch.get("Returned") or 0
            available = qty - out - sold
            
            first_item = items[0] if items else {}
            
            # Sort Item IDs
            item_id_list = [i.get("Item_id") for i in items if i.get("Item_id")]
            def sort_key(x):
                try:
                    return int(x.split("/")[-1])
                except:
                    return 0
            item_id_list.sort(key=sort_key)
            
            id_range = "-"
            if item_id_list:
                id_range = f"{item_id_list[0]} - {item_id_list[-1]}"
            
            results.append({
                "batchCode": batch.get("Batch_code"),
                "productName": po.get("Item_name"),
                "category": po.get("Category") or "-",
                "size": first_item.get("Size") or "-",
                "colour": po.get("Colour") or "-",
                "idRange": id_range,
                "quantity": qty,
                "out": out,
                "sold": sold,
                "returned": returned,
                "available": available,
                "arrivalDate": batch.get("Arrival_date") or "-",
                "items": items
            })
            
        return results

    except Exception as e:
        print("Stock Counts Error:", e)
        raise HTTPException(status_code=500, detail=str(e))
