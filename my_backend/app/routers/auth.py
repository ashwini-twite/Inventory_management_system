from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login")
def login(request: LoginRequest):
    # Hardcoded Admin Check
    if request.email == "admin@gmail.com" and request.password == "admin123":
        return {"status": "success", "token": "admin-logged-in"}
    else:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
