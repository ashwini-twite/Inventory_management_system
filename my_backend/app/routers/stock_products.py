from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from app.database import supabase

router = APIRouter(prefix="/stock", tags=["Stock Products"])

@router.get("/products")
def get_stock_products(category: str):
    try:
        cat_filter = category.lower()
        
        # 1. Fetch Products
        products_query = supabase.table("Products").select("*, Purchase_order_items(Colour)").in_("Status", ["Available", "Returned"]).execute()
        
        if not products_query.data:
            return []
            
        all_products = products_query.data
        
        # 2. Filter by Category
        filtered_products = [p for p in all_products if (p.get("Category") or "").lower() == cat_filter]
        
        if not filtered_products:
            return []
            
        # 3. Fetch Batches
        batch_ids = list(set([p["Batch_id"] for p in filtered_products if p.get("Batch_id")]))
        
        batch_map = {}
        if batch_ids:
            batches_res = supabase.table("Stock_batches").select("*").in_("Batch_id", batch_ids).execute()
            if batches_res.data:
                batch_map = {b["Batch_id"]: b for b in batches_res.data}
                
        # 4. Group by Batch
        grouped = {}
        for p in filtered_products:
            bid = p.get("Batch_id")
            if not bid: continue
            if bid not in grouped:
                grouped[bid] = []
            grouped[bid].append(p)
            
        # 5. Construct Response
        results = []
        for bid, items in grouped.items():
            if not items: continue
            
            first = items[0]
            batch_info = batch_map.get(bid, {})
            
            qty = batch_info.get("Batch_quantity") or len(items)
            out = batch_info.get("Out") or 0
            sold = batch_info.get("Sold") or 0
            returned = batch_info.get("Returned") or 0
            available = qty - out - sold 
            
            # Item IDs sorting
            item_ids = [i.get("Item_id") for i in items if i.get("Item_id")]
            def sort_key(x):
                try:
                    return int(x.split("/")[-1])
                except:
                    return 0
            item_ids.sort(key=sort_key)
            
            id_range = "-"
            if item_ids:
                id_range = f"{item_ids[0]} - {item_ids[-1]}"
                
            po_item = first.get("Purchase_order_items")
            colour = "-"
            if po_item:
                if isinstance(po_item, list) and po_item:
                    colour = po_item[0].get("Colour") or "-"
                elif isinstance(po_item, dict):
                    colour = po_item.get("Colour") or "-"

            
            results.append({
                "batchId": bid,
                "batchCode": batch_info.get("Batch_code") or first.get("Batch_code") or "-",
                "productName": first.get("Product_name") or "-",
                "size": first.get("Size") or "-",
                "colour": colour,
                "category": first.get("Category") or "-",
                "qty": qty,
                "out": out,
                "sold": sold,
                "returned": returned,
                "available": available,
                "idRange": id_range,
                "itemIds": item_ids,
                "items": items
            })
            
        return results

    except Exception as e:
        print("Stock Products Error:", e)
        raise HTTPException(status_code=500, detail=str(e))
