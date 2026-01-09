from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.routers import (
    reports,
    purchase_orders,
    clients,
    stock_counts,
    stock_products,
    reserved_stock,
    scan,
    returns,
    dashboard
)

app = FastAPI()

# ✅ CORS CONFIG (keep for safety)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all for testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ API ROUTERS
app.include_router(reports.router)
app.include_router(purchase_orders.router)
app.include_router(clients.router)
app.include_router(stock_counts.router)
app.include_router(stock_products.router)
app.include_router(reserved_stock.router)
app.include_router(scan.router)
app.include_router(returns.router)
app.include_router(dashboard.router)

# ================================
# ✅ SERVE REACT FRONTEND
# ================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Serve React assets
app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

# Serve index.html
@app.get("/")
def serve_frontend():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))
