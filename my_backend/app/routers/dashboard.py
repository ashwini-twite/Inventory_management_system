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
        low_stock_count = sum(1 for b in batches if b.get("Available", 0) <= 5)
        
        # 2. Fetch Categories for Pie Chart & Stats
        # We need to map Po_item_id -> Category
        # We also need this to group batches by category
        p_res = supabase.table("Purchase_order_items").select("Po_item_id, Category").execute()
        po_items = p_res.data or []
        po_map = {p["Po_item_id"]: p["Category"] for p in po_items}
        
        category_stats = {}
        # Format: { "Category": { total, available, sold, returned, lowBatches } }
        
        for b in batches:
            pid = b.get("Po_item_id")
            cat = po_map.get(pid, "Unknown")
            
            if cat not in category_stats:
                category_stats[cat] = {
                    "total": 0, "available": 0, "sold": 0, "returned": 0, "lowBatches": 0
                }
            
            s = category_stats[cat]
            s["total"] += b["Batch_quantity"]
            s["available"] += b.get("Available", 0)
            s["sold"] += b.get("Sold", 0)
            s["returned"] += b.get("Returned", 0)
            if b.get("Available", 0) <= 5: 
                s["lowBatches"] += 1

        # 3. Monthly Sales (Line Chart)
        # We need "Sold" movements
        m_res = supabase.table("Stock_movement").select("Movement_type, Scan_date").eq("Movement_type", "Sold").execute()
        movements = m_res.data or []
        
        month_map = {}
        for m in movements:
            date_str = m.get("Scan_date")
            if not date_str: continue
            
            # Parse date and get "MMM yyyy"
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                key = dt.strftime("%b %Y")
                month_map[key] = month_map.get(key, 0) + 1
            except:
                pass
                
        # Sort months chronologically? 
        # For simplicity, we send them as lists and let frontend or python sort.
        # Python 3.7+ dicts preserve insertion order, but keys might be unsorted.
        # Let's sort by date object.
        sorted_month_keys = sorted(month_map.keys(), key=lambda x: datetime.strptime(x, "%b %Y"))
        monthly_sales = [{"label": k, "value": month_map[k]} for k in sorted_month_keys]

        # 4. Weekly Sales & Recent Sales (KPIs)
        # "Weekly Sales" usually means "Sold within last 7 days"
        # "Sold This Month" means "Sold in current month"
        now = datetime.now()
        start_of_week = now - timedelta(days=7)
        start_of_month = now.replace(day=1)
        
        weekly_sales_count = 0
        monthly_sales_count = 0 
        monthly_returns_count = 0 # Also need returns this month
        
        # We can optimize this by using DB filters, but we already fetched all "Sold" movements?
        # Actually in step 3 we fetched ALL sold movements. We can reuse 'movements' for sold stats.
        
        for m in movements:
            ds = m.get("Scan_date")
            if not ds: continue
            try:
                dt = datetime.strptime(ds, "%Y-%m-%d")
                if dt >= start_of_week:
                    weekly_sales_count += 1
                if dt >= start_of_month:
                    monthly_sales_count += 1
            except: pass
            
        # For returns, we need to fetch return movements or just trust 'Returned' count in batches?
        # Batches 'Returned' is ALL TIME returns.
        # KPI says "Returns This Month". So we need return movements.
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
