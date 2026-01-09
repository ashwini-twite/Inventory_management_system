from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import reports, purchase_orders, clients, stock_counts, stock_products, reserved_stock, scan, returns, dashboard, auth

app = FastAPI()

# ✅ CORS CONFIG
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "https://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reports.router)
app.include_router(purchase_orders.router)
app.include_router(clients.router)
app.include_router(stock_counts.router)
app.include_router(stock_products.router)
app.include_router(reserved_stock.router)
app.include_router(scan.router)
app.include_router(returns.router)
app.include_router(dashboard.router)
app.include_router(auth.router)

@app.get("/")
def home():
    return {"message": "Backend is running!"}
