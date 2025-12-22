from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.database import supabase

router = APIRouter(prefix="/returns", tags=["Returns"])

@router.get("/")
def get_returns():
    try:
        # Fetch all returns, ordered by latest first
        res = supabase.table("Return_list").select("*").order("return_date", desc=True).execute()
        
        if not res.data:
            return []
            
        return res.data
        
    except Exception as e:
        print("Get Returns Error:", e)
        raise HTTPException(status_code=500, detail=str(e))
