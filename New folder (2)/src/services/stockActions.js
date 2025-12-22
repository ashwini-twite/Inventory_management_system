// src/services/stockActions.js
import { supabase } from "../supabaseClient";

/* -----------------------------------------------------------
    COMMON: LOG MOVEMENT
----------------------------------------------------------- */
export async function logMovement({
  stockId,
  type,
  clientId = null,
  doNo = null,
  mode = null,
  reason = null,
}) {
  await supabase.from("Stock_movement").insert({
    Stock_id: stockId,
    Movement_type: type,
    Client_id: clientId,
    Delivery_order_no: doNo,
    Scan_date: new Date().toISOString().slice(0, 10),
    delivery_mode: mode,
    undo_reason: reason,
  });
}

/* -----------------------------------------------------------
    UPDATE BATCH COUNTS (FINAL CORRECT VERSION)
----------------------------------------------------------- */
async function updateBatchCounts(stockId, updateType) {
  const { data: prod, error: prodErr } = await supabase
    .from("Products")
    .select("Batch_id")
    .eq("Stock_id", stockId)
    .single();

  if (prodErr || !prod?.Batch_id) return;

  const batchId = prod.Batch_id;

  const { data: batch } = await supabase
    .from("Stock_batches")
    .select("*")
    .eq("Batch_id", batchId)
    .single();

  if (!batch) return;

  let { Batch_quantity, Out, Sold, Returned } = batch;
  Out ||= 0;
  Sold ||= 0;
  Returned ||= 0;

  switch (updateType) {
    case "markOut":
      Out += 1;
      break;

    case "clearSale":
      Out -= 1;
      Sold += 1;
      break;

    case "undoSale":
      Sold -= 1;
      Out += 1;
      break;

    case "returnBefore":
      Out -= 1;
      Returned += 1;
      break;

    case "returnAfter":
      Sold -= 1;
      Returned += 1;
      break;
  }

  const Available = Batch_quantity - Out - Sold;

  await supabase
    .from("Stock_batches")
    .update({
      Out,
      Sold,
      Returned,
      Available,
      Updated_at: new Date().toISOString(),
    })
    .eq("Batch_id", batchId);
}

/* -----------------------------------------------------------
    INSERT RETURN ENTRY (UPDATED)
----------------------------------------------------------- */
async function addToReturnList(stockId, reason, tag, overrideDo = null) {
  const { data: prod, error } = await supabase
  .from("Products")
  .select(`
  Stock_id,
  Item_id,
  Product_name,
  Size,
  Batch_code,
  Client_id,
  Delivery_order_no,
  Po_item_id,

  Purchase_order_items!Products_Po_item_id_fkey (
    Colour
  ),

  Clients ( Client_name )
`)

  .eq("Stock_id", stockId)
  .single();


  if (error || !prod) return;
  const colour =
  prod.Purchase_order_items?.Colour ?? "-";



const payload = {
  stock_id: prod.Stock_id,
  item_ids: [prod.Item_id],
  product_name: prod.Product_name,
  size: prod.Size,
  colour,                 // ✅ NOW STORED
  batch_code: prod.Batch_code,
  client_id: prod.Client_id,
  client_name: prod.Clients?.Client_name || null,
  do_number: overrideDo ?? prod.Delivery_order_no,
  reason: reason || tag,
  is_bulk: false,
};


  
  await supabase.from("Return_list").insert(payload);
}

/* -----------------------------------------------------------
    MARK OUT
----------------------------------------------------------- */

export async function markOut(stockId, clientId, doNo, mode = "Scan") {
  if (!doNo) {
  alert("Delivery Order number is required before dispatch");
  return false;
}

  const { data: prod, error } = await supabase
    .from("Products")
    .select("Status")
    .eq("Stock_id", stockId)
    .single();

  if (error || !prod) return false;

  if (prod.Status === "Out") return false;
  if (prod.Status === "Sold") return false;

  await supabase
    .from("Products")
    .update({
      Status: "Out",
      Client_id: clientId,
      Delivery_order_no: doNo,
      Updated_at: new Date().toISOString(),
    })
    .eq("Stock_id", stockId);

  await supabase.from("Reserved_stocks").insert({
    Stock_id: stockId,
    Client_id: clientId,
    Delivery_order_no: doNo,
  });

  await updateBatchCounts(stockId, "markOut");

  await logMovement({
    stockId,
    type: "Out",
    clientId,
    doNo,
    mode,
  });

  window.dispatchEvent(new Event("stock-updated"));
  return true;
}

/* -----------------------------------------------------------
    CLEAR RESERVED → SOLD
----------------------------------------------------------- */
export async function clearReservedSale(stockId) {
  const { data: prod } = await supabase
    .from("Products")
    .select("Status, Client_id, Delivery_order_no")
    .eq("Stock_id", stockId)
    .single();

  if (!prod || prod.Status !== "Out") return;

  await supabase
    .from("Products")
    .update({
      Status: "Sold",
      Updated_at: new Date().toISOString(),
    })
    .eq("Stock_id", stockId);

  await supabase.from("Reserved_stocks").delete().eq("Stock_id", stockId);

  await updateBatchCounts(stockId, "clearSale");

  await logMovement({
    stockId,
    type: "Sold",
    clientId: prod.Client_id,
    doNo: prod.Delivery_order_no,
    mode: "Reserved Clear",
  });

  window.dispatchEvent(new Event("stock-updated"));
}

/* -----------------------------------------------------------
    UNDO SALE
----------------------------------------------------------- */
export async function undoSale(stockId, reason = "Undo sale") {
  const { data: prod } = await supabase
    .from("Products")
    .select("Status, Client_id, Delivery_order_no")
    .eq("Stock_id", stockId)
    .single();

  if (!prod || prod.Status !== "Sold") return;

  await supabase
    .from("Products")
    .update({
      Status: "Out",
      Updated_at: new Date().toISOString(),
    })
    .eq("Stock_id", stockId);

  await supabase.from("Reserved_stocks").insert({
    Stock_id: stockId,
    Client_id: prod.Client_id,
    Delivery_order_no: prod.Delivery_order_no,
  });

  await updateBatchCounts(stockId, "undoSale");

  await logMovement({
    stockId,
    type: "Undo Sale",
    clientId: prod.Client_id,
    doNo: prod.Delivery_order_no,
    reason,
  });

  window.dispatchEvent(new Event("stock-updated"));
}

/* -----------------------------------------------------------
    RETURN BEFORE INVOICE (UPDATED)
----------------------------------------------------------- */
export async function returnBefore(stockId, reason = "Return before invoice") {
  // 1️⃣ Get DO BEFORE clearing it
  const { data: beforeClear } = await supabase
    .from("Products")
    .select("Status, Client_id, Delivery_order_no")
    .eq("Stock_id", stockId)
    .single();

  if (!beforeClear || beforeClear.Status !== "Out") return;

  const oldDo = beforeClear.Delivery_order_no;

  // 2️⃣ Log return BEFORE clearing DO
  await addToReturnList(stockId, reason, "Return Before Invoice", oldDo);

  // 3️⃣ Update product → Available (NOW safe to clear DO)
  await supabase
    .from("Products")
    .update({
      Status: "Available",
      Client_id: null,
      Delivery_order_no: null,
      Updated_at: new Date().toISOString(),
    })
    .eq("Stock_id", stockId);

  await supabase.from("Reserved_stocks").delete().eq("Stock_id", stockId);

  await updateBatchCounts(stockId, "returnBefore");

  await logMovement({
    stockId,
    type: "Return Before Invoice",
    reason,
  });

  window.dispatchEvent(new Event("stock-updated"));
}

/* -----------------------------------------------------------
    RETURN AFTER SALE (UPDATED)
----------------------------------------------------------- */
export async function returnAfter(stockId, reason = "Return after sale") {
  // 1️⃣ Get DO BEFORE clearing it
  const { data: beforeClear } = await supabase
    .from("Products")
    .select("Status, Client_id, Delivery_order_no")
    .eq("Stock_id", stockId)
    .single();

  if (!beforeClear || beforeClear.Status !== "Sold") return;

  const oldDo = beforeClear.Delivery_order_no;

  // 2️⃣ Log return BEFORE clearing DO
  await addToReturnList(stockId, reason, "Return After Sale", oldDo);

  // 3️⃣ Update product → Available
  await supabase
    .from("Products")
    .update({
      Status: "Available",
      Client_id: null,
      Delivery_order_no: null,
      Updated_at: new Date().toISOString(),
    })
    .eq("Stock_id", stockId);

  await updateBatchCounts(stockId, "returnAfter");

  await logMovement({
    stockId,
    type: "Return After Sale",
    reason,
  });

  window.dispatchEvent(new Event("stock-updated"));
}
