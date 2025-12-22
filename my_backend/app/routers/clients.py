from fastapi import APIRouter, HTTPException, Body
from typing import List, Optional
from pydantic import BaseModel
from app.database import supabase

router = APIRouter(prefix="/clients", tags=["Clients"])

# --- Pydantic Models ---

class ClientSchema(BaseModel):
    Client_name: str
    Contact: Optional[str] = None
    Email: Optional[str] = None
    Address_line: Optional[str] = None
    Address_location: Optional[str] = None
    Address_city: Optional[str] = None
    Address_state: Optional[str] = None
    Country: Optional[str] = None
    Postal_code: Optional[str] = None
    Vat_number: Optional[str] = None

# --- Endpoints ---

@router.get("/")
def list_clients():
    try:
        response = supabase.table("Clients").select("*").order("Client_id", desc=False).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def create_client(payload: ClientSchema):
    try:
        # Match Supabase columns (Case Sensitive if needed, but usually matching Pydantic is fine)
        data = payload.dict()
        response = supabase.table("Clients").insert(data).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create client")
        return {"success": True, "data": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{client_id}")
def update_client(client_id: int, payload: ClientSchema):
    try:
        data = payload.dict()
        response = supabase.table("Clients").update(data).eq("Client_id", client_id).execute()
        if not response.data:
             # Could mean not found or update returned nothing
             # We can check if it exists first or just assume success if no error
             pass
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{client_id}")
def delete_client(client_id: int):
    try:
        supabase.table("Clients").delete().eq("Client_id", client_id).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
