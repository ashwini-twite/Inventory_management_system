from fastapi import APIRouter, HTTPException
from typing import List, Optional, Dict, Any
from app.database import supabase
from datetime import datetime, timedelta

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/")
def get_dashboard_data():
    try:
        # 1. Fetch arrived PO item IDs
        arrived_items_res = supabase.table("Purchase_order_items").select("Po_item_id").eq("Arrival_status", "Arrived").execute()
        arrived_ids = [it["Po_item_id"] for it in arrived_items_res.data or []]
        
        batches = []
        if arrived_ids:
            # 2. Fetch Stock Batches for arrived items
            b_res = supabase.table("Stock_batches").select("Batch_quantity, Available, Sold, Returned, Po_item_id").in_("Po_item_id", arrived_ids).execute()
            batches = b_res.data or []
        
        total_stock = sum(b["Batch_quantity"] for b in batches)
        available_stock = sum(b.get("Available", 0) for b in batches)
        sold_stock = sum(b.get("Sold", 0) for b in batches)
        returned_stock = sum(b.get("Returned", 0) for b in batches)
        # 2. Fetch Categories for Pie Chart & Stats
        # We need to map Po_item_id -> Category
        p_res = supabase.table("Purchase_order_items").select("Po_item_id, Category").execute()
        po_items = p_res.data or []
        po_map = {p["Po_item_id"]: p["Category"] for p in po_items}
        
        # Thresholds configuration
        THRESHOLDS = {
            "Granite": 10,
            "Quartz": 10,
            "Monuments": 5
        }
        DEFAULT_THRESHOLD = 5

        category_stats = {}
        # Format: { "Category": { total, available, sold, returned, lowBatches } }
        
        low_stock_count = 0
        for b in batches:
            pid = b.get("Po_item_id")
            cat = po_map.get(pid, "Unknown")
            
            if cat not in category_stats:
                category_stats[cat] = {
                    "total": 0, "available": 0, "sold": 0, "returned": 0, "lowBatches": 0
                }
            
            s = category_stats[cat]
            available = b.get("Available", 0)
            
            s["total"] += b["Batch_quantity"]
            s["available"] += available
            s["sold"] += b.get("Sold", 0)
            s["returned"] += b.get("Returned", 0)
            
            # Category-specific threshold
            threshold = THRESHOLDS.get(cat, DEFAULT_THRESHOLD)
            if available <= threshold: 
                s["lowBatches"] += 1
                low_stock_count += 1

        # 3. Monthly Sales (Grouped Bar Chart)
        # We need "Sold" movements joined (manually) with Products to get Category AND current Status
        m_res = supabase.table("Stock_movement").select("Scan_date, Stock_id").eq("Movement_type", "Sold").execute()
        movements = m_res.data or []
        
        # Unique Stock IDs to fetch categories and current status
        sold_stock_ids = list(set([m["Stock_id"] for m in movements if m.get("Stock_id")]))
        
        product_info_map = {} # { stock_id: { category, status } }
        if sold_stock_ids:
            # We fetch both Category (for grouping) and Status (to exclude returned items)
            p_res = supabase.table("Products").select("Stock_id, Category, Status").in_("Stock_id", sold_stock_ids).execute()
            product_info_map = {p["Stock_id"]: {"category": p["Category"], "status": p["Status"]} for p in p_res.data or []}

        # Filter movements: "consider only current sold status"
        # If an item was sold but is now back in "Available" or "Returned" status, don't count it as a sale.
        valid_movements = []
        for m in movements:
            sid = m.get("Stock_id")
            info = product_info_map.get(sid)
            # Only consider movements for products that are CURRENTLY in "Sold" status
            if info and info.get("status") == "Sold":
                valid_movements.append(m)
        
        # Use valid_movements for all subsequent sold-related calculations
        month_map = {} # { "MMM YYYY": { "granite": 0, "quartz": 0, "monuments": 0 } }
        for m in valid_movements:
            date_str = m.get("Scan_date")
            sid = m.get("Stock_id")
            if not date_str: continue
            
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                month_key = dt.strftime("%b %Y")
                cat = product_info_map.get(sid, {}).get("category", "others")
                
                if month_key not in month_map:
                    month_map[month_key] = {"granite": 0, "quartz": 0, "monuments": 0, "others": 0}
                
                # Standardize category name for matching
                cat_lower = (cat or "").lower()
                if "granite" in cat_lower: cat_key = "granite"
                elif "quartz" in cat_lower or "quart" in cat_lower: cat_key = "quartz"
                elif "monument" in cat_lower: cat_key = "monuments"
                else: cat_key = "others"
                
                month_map[month_key][cat_key] += 1
            except:
                pass
                
        sorted_month_keys = sorted(month_map.keys(), key=lambda x: datetime.strptime(x, "%b %Y"))
        monthly_sales = []
        for k in sorted_month_keys:
            entry = {"label": k}
            entry.update(month_map[k])
            monthly_sales.append(entry)

        # 4. Weekly Sales & Recent Sales (KPIs) using the same filtered valid_movements
        now = datetime.now()
        start_of_week = now - timedelta(days=7)
        start_of_month = now.replace(day=1)
        
        weekly_sales_count = 0
        monthly_sales_count = 0 
        monthly_returns_count = 0 
        
        for m in valid_movements:
            ds = m.get("Scan_date")
            if not ds: continue
            try:
                dt = datetime.strptime(ds, "%Y-%m-%d")
                if dt >= start_of_week:
                    weekly_sales_count += 1
                if dt >= start_of_month:
                    monthly_sales_count += 1
            except: pass
            
        # Returns This Month still counts all return movements in the current month
        r_mov_res = supabase.table("Stock_movement").select("Movement_type, Scan_date").ilike("Movement_type", "%Return%").execute()
        r_movements = r_mov_res.data or []
        
        for m in r_movements:
            ds = m.get("Scan_date")
            if not ds: continue
            try:
                dt = datetime.strptime(ds, "%Y-%m-%d")
                if dt >= start_of_month:
                    monthly_returns_count += 1
            except: pass


        return {
            "kpis": {
                "total": total_stock,
                "available": available_stock,
                "weekly": weekly_sales_count,
                "sold": monthly_sales_count,
                "returns": monthly_returns_count,
                "low": low_stock_count
            },
            "category_stats": category_stats,
            "monthly_sales": monthly_sales,
            # Helper list for pie chart (Category Name -> Available Count)
            "stock_category": [{"label": k, "value": v["available"]} for k,v in category_stats.items()],
            # Helper list for donut (Status)
            "stock_status": [
                {"label": "Available", "value": available_stock},
                {"label": "Sold", "value": sold_stock},
                {"label": "Returned", "value": returned_stock}
            ]
        }
        
    except Exception as e:
        print("Dashboard Error:", e)
        raise HTTPException(status_code=500, detail=str(e))
