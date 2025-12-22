from fastapi import APIRouter
from app.database import supabase

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/stock-summary")
def get_stock_summary():
    # Step 1: Fetch arrived PO items and Batches
    arrived_res = supabase.table("Purchase_order_items").select("Po_item_id").eq("Arrival_status", "Arrived").execute()
    arrived_ids = [it["Po_item_id"] for it in arrived_res.data or []]
    
    batches = []
    if arrived_ids:
        batches = supabase.table("Stock_batches").select("*").in_("Po_item_id", arrived_ids).execute().data or []

    # Step 2: Fetch PO Items (to get category)
    po_items = supabase.table("Purchase_order_items").select("Po_item_id, Category").execute().data

    # Convert PO items into lookup dictionary
    category_lookup = {item["Po_item_id"]: item["Category"] for item in po_items}

    summary = {}

    for row in batches:
        po_item_id = row["Po_item_id"]
        category = category_lookup.get(po_item_id, "Unknown")

        if category not in summary:
            summary[category] = {
                "category": category,
                "totalQuantity": 0,
                "totalOut": 0,
                "totalSold": 0,
                "totalReturned": 0,
                "totalAvailable": 0,
            }

        summary[category]["totalQuantity"] += row["Batch_quantity"]
        summary[category]["totalOut"] += row["Out"]
        summary[category]["totalSold"] += row["Sold"]
        summary[category]["totalReturned"] += row["Returned"]
        summary[category]["totalAvailable"] += row["Available"]

    return list(summary.values())

@router.get("/batch-wise")
def get_batch_wise_stock():
    # 1️⃣ Fetch arrived PO item IDs
    arrived_res = supabase.table("Purchase_order_items").select("Po_item_id").eq("Arrival_status", "Arrived").execute()
    arrived_ids = [it["Po_item_id"] for it in arrived_res.data or []]
    
    batches = []
    if arrived_ids:
        batches = supabase.table("Stock_batches").select("*").in_("Po_item_id", arrived_ids).execute().data or []

    # 2️⃣ Fetch PO items to get category + item names
    po_items = supabase.table("Purchase_order_items") \
        .select("Po_item_id, Category, Item_name") \
        .execute().data

    # 3️⃣ Create lookup for PO items
    po_lookup = {
        item["Po_item_id"]: {
            "category": item["Category"],
            "item_name": item["Item_name"]
        }
        for item in po_items
    }

    # 4️⃣ Build batch → unique item names set
    batch_item_names = {}

    for batch in batches:
        batch_id = batch["Batch_id"]
        po_item_id = batch["Po_item_id"]

        if batch_id not in batch_item_names:
            batch_item_names[batch_id] = set()

        if po_item_id in po_lookup:
            batch_item_names[batch_id].add(
                po_lookup[po_item_id]["item_name"]
            )

    result = []

    for batch in batches:
        batch_id = batch["Batch_id"]
        po_item_id = batch["Po_item_id"]

        category = po_lookup.get(po_item_id, {}).get("category", "Unknown")

        result.append({
            "batchCode": batch["Batch_code"],
            "category": category,
            "itemCount": len(batch_item_names.get(batch_id, set())),
            "batchQuantity": batch["Batch_quantity"],
            "sold": batch["Sold"],
            "out": batch["Out"],
            "returned": batch["Returned"],
            "available": batch["Available"],
        })

    return result
@router.get("/item-wise")
def get_item_wise_stock():
    # 1️⃣ Fetch products (items)
    products = supabase.table("Products") \
    .select("""
        Stock_id,
        Item_id,
        Product_name,
        Size,
        Category,
        Batch_code,
        Status,
        Client_id,
        Delivery_order_no,
        Created_at,
        Purchase_order_items (
            Colour
        )
    """) \
    .execute().data


    # 2️⃣ Fetch clients
    clients = supabase.table("Clients") \
        .select("Client_id, Client_name") \
        .execute().data

    # 3️⃣ Client lookup
    client_lookup = {
        c["Client_id"]: c["Client_name"]
        for c in clients
    }

    # 4️⃣ Build response
    result = []

    for item in products:
        colour = (
            item.get("Purchase_order_items", {}).get("Colour")
            if item.get("Purchase_order_items")
            else "-"
        )

        result.append({
            "itemId": item["Item_id"],
            "productName": item["Product_name"],
            "size": item["Size"],
            "colour": colour,
            "category": item["Category"],
            "batchCode": item["Batch_code"],
            "status": item["Status"],
            "clientName": client_lookup.get(item["Client_id"], "-"),
            "deliveryOrderNo": item["Delivery_order_no"],
            "createdDate": item["Created_at"]
        })


    return result
@router.get("/sales")
def get_sales_report():
    movements = supabase.table("Stock_movement") \
        .select("""
            Stock_id,
            Client_id,
            Delivery_order_no,
            Scan_date,
            delivery_mode,
            Products (
                Item_id,
                Product_name,
                Size,
                Category,
                Batch_code,
                Purchase_order_items (
                    Colour
                )
            ),
            Clients (
                Client_name
            )
        """) \
        .eq("Movement_type", "Sold") \
        .execute().data

    result = []

    for m in movements:
        product = m.get("Products") or {}
        client = m.get("Clients") or {}

        colour = (
            product.get("Purchase_order_items", {}).get("Colour")
            if product.get("Purchase_order_items")
            else "-"
        )

        result.append({
            "batchCode": product.get("Batch_code"),
            "itemId": product.get("Item_id"),
            "productName": product.get("Product_name"),
            "size": product.get("Size"),
            "colour": colour,
            "category": product.get("Category"),
            "clientName": client.get("Client_name"),
            "deliveryOrderNo": m.get("Delivery_order_no"),
            "saleDate": m.get("Scan_date"),
            "deliveryMode": m.get("delivery_mode"),
        })

    return result

@router.get("/returns")
def get_returns_report():
    rows = supabase.table("Return_list") \
        .select("""
    item_ids,
    product_name,
    size,
    colour,
    batch_code,
    client_name,
    do_number,
    return_date,
    reason,
    is_bulk
""")\
        .order("return_date", desc=True) \
        .execute().data

    result = []

    for r in rows:
      result.append({
    "itemIds": r.get("item_ids", []),
    "productName": r.get("product_name"),
    "size": r.get("size"),
    "colour": r.get("colour") or "-",
    "category": "-",  # snapshot not stored; safe fallback
    "batchCode": r.get("batch_code"),
    "clientName": r.get("client_name"),
    "deliveryOrderNo": r.get("do_number"),
    "returnDate": r.get("return_date"),
    "reason": r.get("reason"),
    "bulk": r.get("is_bulk", False),
})
  

    return result
@router.get("/low-stock")
def get_low_stock():
    # 1. Fetch arrived PO item IDs
    arrived_res = supabase.table("Purchase_order_items").select("Po_item_id").eq("Arrival_status", "Arrived").execute()
    arrived_ids = [it["Po_item_id"] for it in arrived_res.data or []]
    
    batches = []
    if arrived_ids:
        batches = supabase.table("Stock_batches").select("*").in_("Po_item_id", arrived_ids).execute().data or []
    
    # 2. Fetch PO Items (for Category, Item Name)
    po_items = supabase.table("Purchase_order_items").select("Po_item_id, Category, Item_name").execute().data
    po_lookup = {
        p["Po_item_id"]: {"category": p["Category"], "itemName": p["Item_name"]} 
        for p in po_items
    }

    # 3. Filter Low Stock & Build Response
    low_stock = []
    threshold = 5

    for b in batches:
        avail = b.get("Available", 0)
        if avail <= threshold:
            po_id = b.get("Po_item_id")
            details = po_lookup.get(po_id, {})
            
            low_stock.append({
                "batchCode": b["Batch_code"],
                "itemName": details.get("itemName", "-"),
                "category": details.get("category", "-"),
                "availableQuantity": avail,
                "threshold": threshold,
                "status": "LOW STOCK"
            })

    return low_stock

@router.get("/payments")
def get_payments_report():
    # 1️⃣ Fetch purchase orders
    orders = supabase.table("Purchase_orders") \
        .select("Po_id, Po_invoice_no, Vendor_id") \
        .execute().data

    # 2️⃣ Fetch vendors
    vendors = supabase.table("Vendors") \
        .select("Vendor_id, Vendor_name") \
        .execute().data
    vendor_lookup = {v["Vendor_id"]: v["Vendor_name"] for v in vendors}

    # 3️⃣ Fetch PO items to calculate total amount
    items = supabase.table("Purchase_order_items") \
        .select("Po_id, Total_price") \
        .execute().data

    total_lookup = {}
    for item in items:
        total_lookup[item["Po_id"]] = total_lookup.get(item["Po_id"], 0) + (item["Total_price"] or 0)

    # 4️⃣ Fetch payments
        payments = supabase.table("Payments") \
        .select("Po_id, Amount, Payment_date, Created_at, Notes") \
        .execute().data

    payments_by_po = {}
    for p in payments:
        po_id = p["Po_id"]
        payments_by_po.setdefault(po_id, []).append(p)


    # 5️⃣ Build report
    report = []

    for po in orders:
        po_id = po["Po_id"]
        total = total_lookup.get(po_id, 0)
        po_payments = payments_by_po.get(po_id, [])

        paid = sum(p["Amount"] for p in po_payments)

        if paid == 0:
            status = "Pending"
            payment_date = None
        elif paid < total:
            status = "Partial Paid"
            payment_date = None
        else:
            status = "Paid"
            payment_date = max(p["Payment_date"] for p in po_payments)

        created_at = (
            min(p["Created_at"] for p in po_payments)
            if po_payments
            else None
        )

        report.append({
            "poInvoiceNumber": po["Po_invoice_no"],
            "vendorName": vendor_lookup.get(po["Vendor_id"], "Unknown"),
            "paymentDate": payment_date,     # ✅ date PO became fully paid
            "amount": paid,
            "paymentStatus": status,
            "notes": "",
            "createdAt": created_at,          # ✅ first payment timestamp
        })

    return report

@router.get("/movement")
def get_movement_history():
    movements = supabase.table("Stock_movement") \
        .select("""
            Stock_id, Movement_type, Scan_date, delivery_mode, undo_reason,
            Client_id, Delivery_order_no,
            Products ( Item_id, Product_name ),
            Clients ( Client_name )
        """) \
        .order("Scan_date", desc=True) \
        .execute().data
        
    result = []
    
    for m in movements:
        prod = m.get("Products") or {}
        client = m.get("Clients") or {}
        
        # Determine User Name (not stored in DB currently, placeholder)
        user_name = "-" 
        
        result.append({
            "itemId": prod.get("Item_id"),
            "productName": prod.get("Product_name"),
            "movementType": m.get("Movement_type"),
            "scanDate": m.get("Scan_date"),
            "clientName": client.get("Client_name"),
            "deliveryOrderNo": m.get("Delivery_order_no"),
            "deliveryMode": m.get("delivery_mode"),
            "userName": user_name,
            "undoReason": m.get("undo_reason")
        })
        
    return result
