import { supabase } from "../supabaseClient";
import JsBarcode from "jsbarcode";

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */

// Normalize invoice for batch code
function normalizeInvoice(inv) {
  if (!inv) return "";
  return String(inv)
    .split("")
    .map((ch) => (/[a-z]/.test(ch) ? ch.toUpperCase() : ch))
    .join("");
}

const PREFIX_MAP = {
  monuments: "MN",
  granite: "GR",
  quartz: "QR",
};

function makeBatchCode(prefix, invoiceRaw, idx) {
  const inv = normalizeInvoice(invoiceRaw);
  return `${prefix}-${inv}-I${idx}`;
}

function makePieceCode(batch, p) {
  return `${batch}/${p}`;
}

/* ---------------------------------------------------------
   RANDOM SAFE 6-DIGIT SHORT BARCODE
--------------------------------------------------------- */
function generateRandomShortCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/* ---------------------------------------------------------
   BARCODE (CODE128) → Base64 PNG
--------------------------------------------------------- */
function generateBarcodeBase64(value) {
  const canvas = document.createElement("canvas");

  JsBarcode(canvas, value, {
    format: "CODE128",
    width: 3,          // thicker lines → essential for short codes
    height: 120,       // taller barcode → more readable
    margin: 12,        // proper quiet zone
    displayValue: false,

  });

  return canvas.toDataURL("image/png");
}

/* ---------------------------------------------------------
   Base64 → Blob (Supabase safe)
--------------------------------------------------------- */
function dataURLToBlob(dataUrl) {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}

/* ---------------------------------------------------------
   UPLOAD FILE TO SUPABASE STORAGE
--------------------------------------------------------- */
async function uploadToStorage(fileName, dataUrl) {
  const base64 = dataUrl.split(",")[1];

  // Decode base64 → Uint8Array
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  // Supabase requires File in many regions
  const file = new File([bytes], fileName, { type: "image/png" });

  const { data, error } = await supabase.storage
    .from("qr-codes") // <-- Make sure EXACT bucket name
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: true, // <-- Prevent 400 duplicate errors
    });

  if (error) {
    console.error("SUPABASE UPLOAD ERROR:", error);
    throw error;
  }

  const { data: urlData } = supabase.storage
    .from("qr-codes")
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/* ---------------------------------------------------------
   MAIN — Generate QR / Barcode for all items in PO
--------------------------------------------------------- */
export async function generateAllQR(poId, categoryKey, invoiceNo) {
  console.time("Barcode Generation Total");
  try {
    const { data: items, error: itemErr } = await supabase
      .from("Purchase_order_items")
      .select("*")
      .eq("Po_id", poId)
      .order("Po_item_id");

    if (itemErr) throw itemErr;
    if (!items?.length) return { ok: false, message: "No items found" };

    const PREFIX = PREFIX_MAP[categoryKey] || "MN";

    // Reuse a single canvas for all barcodes
    const canvas = document.createElement("canvas");

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.Batch_created && it.Batch_code) continue;

      const batchCode = makeBatchCode(PREFIX, invoiceNo, i + 1);

      /* 1️⃣ CREATE BATCH */
      const { data: batchRow, error: batchErr } = await supabase
        .from("Stock_batches")
        .insert([
          {
            Po_item_id: it.Po_item_id,
            Batch_quantity: it.Quantity_ordered,
            Purchased: it.Quantity_ordered,
            Out: 0,
            Sold: 0,
            Returned: 0,
            Available: it.Quantity_ordered,
            Arrival_date: new Date().toISOString().slice(0, 10),
            Batch_code: batchCode,
          },
        ])
        .select()
        .single();

      if (batchErr) throw batchErr;

      const batchId = batchRow.Batch_id;
      const qty = Number(it.Quantity_ordered);

      /* 2️⃣ CHECK IF PRODUCTS ALREADY EXIST */
      const { data: existing } = await supabase
        .from("Products")
        .select("Stock_id")
        .eq("Po_item_id", it.Po_item_id)
        .limit(1);

      if (!existing || existing.length === 0) {
        const productData = [];

        // Prepare all data for this batch first
        for (let p = 1; p <= qty; p++) {
          const shortCode = generateRandomShortCode();

          // Generate barcode using reused canvas
          JsBarcode(canvas, shortCode, {
            format: "CODE128",
            width: 3,
            height: 120,
            margin: 12,
            displayValue: false,
          });
          const barcodeBase64 = canvas.toDataURL("image/png");
          const fileName = `${shortCode}_${Date.now()}.png`;

          productData.push({
            shortCode,
            barcodeBase64,
            fileName,
            itemId: makePieceCode(batchCode, p)
          });
        }

        /* 🚀 PARALLEL UPLOAD TO STORAGE (Chunked for stability) */
        console.time(`Upload Batch ${batchCode}`);
        const imageUrls = [];
        const CHUNK_SIZE = 20; // Upload 20 at a time to avoid browser/network throttling

        for (let j = 0; j < productData.length; j += CHUNK_SIZE) {
          const chunk = productData.slice(j, j + CHUNK_SIZE);
          const chunkPromises = chunk.map(pd => uploadToStorage(pd.fileName, pd.barcodeBase64));
          const chunkUrls = await Promise.all(chunkPromises);
          imageUrls.push(...chunkUrls);
        }
        console.timeEnd(`Upload Batch ${batchCode}`);

        const rows = productData.map((pd, index) => ({
          Po_item_id: it.Po_item_id,
          Batch_id: batchId,
          Item_id: pd.itemId,
          Barcode_short: pd.shortCode,
          Qr_image_url: imageUrls[index],
          Product_name: it.Item_name || batchCode,
          Size: `${it.Width || "-"}x${it.Thickness || "-"}x${it.Height || "-"}`,
          Category: it.Category,
          Status: "QR Generated",
          Item_code: batchCode,
          Batch_code: batchCode,
        }));

        const { error: prodErr } = await supabase
          .from("Products")
          .insert(rows);

        if (prodErr) throw prodErr;
      }

      /* 3️⃣ UPDATE ITEM */
      await supabase
        .from("Purchase_order_items")
        .update({
          Batch_created: true,
          Batch_code: batchCode,
          Arrival_status: "QR Generated",
        })
        .eq("Po_item_id", it.Po_item_id);
    }

    console.timeEnd("Barcode Generation Total");
    return { ok: true, message: "Barcode generation success" };
  } catch (err) {
    console.timeEnd("Barcode Generation Total");
    console.error("Barcode generation error:", err);
    return { ok: false, message: "Barcode generation failed" };
  }
}
