from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.database import supabase

router = APIRouter(prefix="/returns", tags=["Returns"])

@router.get("/")
def get_returns():
    try:
        # 1. Fetch all returns
        res = supabase.table("Return_list").select("*").order("return_date", desc=True).execute()
        raw_returns = res.data or []
        
        if not raw_returns:
            return []
            
        # 2. Extract unique Stock IDs to fetch categories
        stock_ids = list(set([r["stock_id"] for r in raw_returns if r.get("stock_id")]))
        
        # 3. Fetch matching products
        category_map = {}
        if stock_ids:
            prod_res = supabase.table("Products").select("Stock_id, Category").in_("Stock_id", stock_ids).execute()
            if prod_res.data:
                category_map = {p["Stock_id"]: p["Category"] for p in prod_res.data}
                
        # 4. Enrich returns with Products object for frontend compatibility
        for r in raw_returns:
            sid = r.get("stock_id")
            cat = category_map.get(sid) or "-"
            r["Products"] = {"Category": cat}
            
        return raw_returns
        
    except Exception as e:
        print("Get Returns Error:", e)
        raise HTTPException(status_code=500, detail=str(e))
