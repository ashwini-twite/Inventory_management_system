// CategoryInputForm.jsx
import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import "../styles/purchaseOrders.css";
import { generateAllQR } from "../services/qrBatchGenerator";

const API_BASE = "http://127.0.0.1:8000";

/*
  CategoryInputForm (full commented version)
  - Single form for Monuments / Granite / Quartz driven by :catName route param
  - Category (display) will be Capitalized: Monuments | Granite | Quartz (Option B)
  - Prefix map: monuments -> MN, granite -> GR, quartz -> QR
  - Batch code format: <PREFIX>-<INVOICE_NORMALIZED>-I<ITEM_INDEX>
    e.g. MN-VE/01020256-I1
    Invoice normalization: alphabetic characters uppercased; digits & symbols kept as-is.
  - Per-piece Item_id stored as text: <BatchCode>/1, <BatchCode>/2, ...
  - Mark All Arrived:
      - creates Stock_batches rows with Batch_code
      - creates Products (per piece) if they don't already exist for that Po_item
      - updates Purchase_order_items with Batch_created=true, Arrival_status='Arrived', Batch_code
*/

const emptyVendor = {
  Vendor_name: "",
  Address_line: "",
  Address_location: "",
  Address_city: "",
  Address_state: "",
  Country: "",
  Postal_code: "",
  Vat_number: "",
};

const emptyPO = {
  Po_invoice_no: "",
  Po_date: null,
  expectedDate: null,
  Notes: "",
};

// Create a new item template for given category display name
const newItemRow = (category) => ({
  Po_item_id: null,
  Item_name: "",
  Category: category || "Monuments",
  Quantity_ordered: "",
  Colour: "",
  Thickness: "",
  Height: "",
  Width: "",
  Unit_price: "",
  Total_price: 0,
  Arrival_status: "ordered",
  Batch_created: false,
  Batch_code: null,
  Edit_count: 0,
});

const currencyOptions = [
  { code: "INR", symbol: "", label: "Indian Rupee" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "", label: "Euro" },
  { code: "GBP", symbol: "", label: "British Pound" },
  { code: "JPY", symbol: "", label: "Japanese Yen" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar" },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar" },
  { code: "AED", symbol: ".", label: "UAE Dirham" },
  { code: "ZAR", symbol: "R", label: "South African Rand" },
];

const getCurrencyMeta = (code) => currencyOptions.find((c) => c.code === code) || currencyOptions[0];
const formatCurrency = (value, code) => {
  const meta = getCurrencyMeta(code);
  const amount = Number(value || 0);
  return `${meta.symbol} ${amount.toFixed(2)} ${meta.code}`;
};

// Prefix map for batch codes
const PREFIX_MAP = {
  monuments: "MN",
  granite: "GR",
  quartz: "QR",
};

// normalize invoice for code: uppercase alphabetic characters, keep digits & symbols as-is
const normalizeInvoiceForCode = (inv) => {
  if (inv === null || inv === undefined) return "";
  const s = String(inv).trim();
  return s
    .split("")
    .map((ch) => (/[a-z]/.test(ch) ? ch.toUpperCase() : ch))
    .join("");
};

const makeBatchCode = (prefix, invoiceRaw, idx) => {
  const inv = normalizeInvoiceForCode(invoiceRaw) || "X";
  return `${prefix}-${inv}-I${idx}`;
};

const makePieceCode = (batchCode, pieceIndex) => `${batchCode}/${pieceIndex}`;

const formatSize = (height, width, thickness) => {
  const hasAny = height || width || thickness;
  if (!hasAny) return "-";
  return `${height || "-"} x ${width || "-"} x ${thickness || "-"}`;
};
const getPaymentStatus = (paid, total) => {
  paid = Number(paid || 0);
  total = Number(total || 0);

  if (total <= 0 || paid <= 0) return "Unpaid";

  if (paid < total) return "Partial Paid";

  if (Math.abs(paid - total) < 0.01) return "Full Paid";

  // should never happen once DB is clean
  return "Unpaid";
};


export default function CategoryInputForm() {
  // route param
  const { catName } = useParams();
  const location = useLocation();
  const CATEGORY_KEY = (catName || "monuments").toLowerCase(); // monuments | granite | quartz
  // display-friendly: Capitalized (Option B)
  const CATEGORY_DISPLAY = CATEGORY_KEY.charAt(0).toUpperCase() + CATEGORY_KEY.slice(1);
  const PREFIX = PREFIX_MAP[CATEGORY_KEY] || "MN";

  // UI state
  const [view, setView] = useState(() =>
    location.state?.view === "form" ? "form" : "list"
  ); // "list" | "form"
  const [vendor, setVendor] = useState(emptyVendor);
  const [poDetails, setPoDetails] = useState(emptyPO);
  const [items, setItems] = useState([newItemRow(CATEGORY_DISPLAY)]);
  const [currency, setCurrency] = useState("INR");

  const [paymentPopup, setPaymentPopup] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState({
    paidAmount: "",
    paidDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [editOrderId, setEditOrderId] = useState(null);
  const [paymentForOrderId, setPaymentForOrderId] = useState(null);
  const [viewOrderId, setViewOrderId] = useState(null);
  // PRINT QR POPUP
  const [printPopup, setPrintPopup] = useState(null);


  const grandTotal = items.reduce((s, it) => s + (parseFloat(it.Total_price) || 0), 0);

  // Reset template and fetch when category changes
  useEffect(() => {
    setItems([newItemRow(CATEGORY_DISPLAY)]);
    setView(location.state?.view === "form" ? "form" : "list");
    fetchAllOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [CATEGORY_KEY, location.state?.view]);

  // ---------- Fetch Purchase Orders (and filter to this category) ----------
  async function fetchAllOrders() {
    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/purchase_orders/list?category=${CATEGORY_KEY}`);
      if (!res.ok) throw new Error("Failed to fetch orders");
      const onlyCategory = await res.json();

      setOrders(onlyCategory);
      setPage(1);
    } catch (err) {
      console.error("Fetch orders error:", err);
      // alert("Unable to fetch orders. Check console.");
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil((orders || []).length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedOrders = (orders || []).slice((safePage - 1) * pageSize, safePage * pageSize);
  const goToPage = (num) => setPage(Math.min(Math.max(1, num), totalPages));

  // ---------- Handlers for form fields (Original Logic) ----------
  const handleVendorChange = (e) => {
    const { name, value } = e.target;
    setVendor((prev) => ({ ...prev, [name]: value }));
  };

  const handlePoChange = (e) => {
    const { name, value } = e.target;
    setPoDetails((prev) => ({ ...prev, [name]: value || null }));
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        if (field === "Quantity_ordered" && it.Batch_created) {
          alert("Quantity locked after batch created.");
          return it;
        }
        const updated = { ...it, [field]: value };
        const qty = parseFloat(updated.Quantity_ordered) || 0;
        const unit = parseFloat(updated.Unit_price) || 0;
        updated.Total_price = qty * unit;
        return updated;
      })
    );
  };

  const addItemRow = () => setItems((p) => [...p, newItemRow(CATEGORY_DISPLAY)]);
  const removeItemRow = (index) => {
    const it = items[index];
    if (it && it.Batch_created) {
      alert("Cannot remove item after batch created.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // ---------- Submit form -> open payment popup (draft saved to window.__poDraft) ----------
  const handleSubmitForm = (e) => {
    e && e.preventDefault();

    const cleaned = items.map((it) => ({
      ...it,
      Quantity_ordered: parseInt(it.Quantity_ordered || 0, 10),
      Unit_price: parseFloat(it.Unit_price || 0),
      Total_price: parseFloat(((parseInt(it.Quantity_ordered || 0, 10) * parseFloat(it.Unit_price || 0)) || 0).toFixed(2)),
      Batch_created: !!it.Batch_created,
      Batch_code: it.Batch_code || null,
    }));

    window.__poDraft = {
      vendorDraft: vendor,
      poDraft: { ...poDetails },
      itemsDraft: cleaned,
      totalAmount: cleaned.reduce((s, x) => s + (x.Total_price || 0), 0),
    };

    setPaymentDetails((p) => ({ ...p, paidAmount: "", paidDate: new Date().toISOString().slice(0, 10) }));
    setPaymentPopup(true);
  };

  // ---------- Save new PO (and optionally payment) (API) ----------
  const handleSavePayment = async () => {
    const pd = window.__poDraft;
    if (!pd) {
      alert("No draft found.");
      setPaymentPopup(false);
      return;
    }
    const amount = parseFloat(paymentDetails.paidAmount || 0) || 0;
    const totalAmount = pd.totalAmount || 0;

    if (amount > totalAmount) {
      alert("Paid amount cannot be greater than total amount");
      return;
    }

    try {
      setLoading(true);

      // Prepare Payload
      const payload = {
        vendor: pd.vendorDraft,
        poDetails: pd.poDraft,
        items: pd.itemsDraft,
        payment: {
          paidAmount: amount,
          paidDate: paymentDetails.paidDate,
          notes: paymentDetails.notes
        }
      };

      const res = await fetch(`${API_BASE}/purchase_orders/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Save failed");
      }

      // Reset UI
      setVendor(emptyVendor);
      setPoDetails(emptyPO);
      setItems([newItemRow(CATEGORY_DISPLAY)]);
      setPaymentPopup(false);
      window.__poDraft = null;

      await fetchAllOrders();
      setView("list");
    } catch (err) {
      console.error("Save PO error:", err);
      alert("Failed to save order. " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Edit existing order ----------
  const handleEditOrder = (poId) => {
    const ord = orders.find((o) => o.Po_id === poId);
    if (!ord) return;

    setVendor({
      Vendor_name: ord.Vendor?.Vendor_name || "",
      Address_line: ord.Vendor?.Address_line || "",
      Address_location: ord.Vendor?.Address_location || "",
      Address_city: ord.Vendor?.Address_city || "",
      Address_state: ord.Vendor?.Address_state || "",
      Country: ord.Vendor?.Country || "",
      Postal_code: ord.Vendor?.Postal_code || "",
      Vat_number: ord.Vendor?.Vat_number || "",
    });

    setPoDetails({
      Po_invoice_no: ord.Po_invoice_no || "",
      Po_date: ord.Po_date || null,
      Notes: ord.Notes || "",
    });

    const mappedItems = (ord.Items || []).map((it) => ({
      Po_item_id: it.Po_item_id || null,
      Item_name: it.Item_name || "",
      Category: it.Category || CATEGORY_DISPLAY,
      Quantity_ordered: it.Quantity_ordered || 0,
      Colour: it.Colour || "",
      Thickness: it.Thickness || "",
      Height: it.Height || "",
      Width: it.Width || "",
      Unit_price: it.Unit_price || 0,
      Total_price: it.Total_price || 0,
      Arrival_status: it.Arrival_status || "ordered",
      Batch_created: !!it.Batch_created,
      Batch_code: it.Batch_code || null,
      Edit_count: it.Edit_count || 0,
    }));

    setItems(mappedItems.length ? mappedItems : [newItemRow(CATEGORY_DISPLAY)]);
    setEditOrderId(poId);
    setView("form");
  };

  // ---------- Update existing order (API) ----------
  const handleUpdateOrder = async (e) => {
    e && e.preventDefault();
    if (!editOrderId) return alert("No order selected for edit");

    try {
      setLoading(true);

      const payload = {
        vendor: vendor,
        poDetails: poDetails,
        items: items
      };

      const res = await fetch(`${API_BASE}/purchase_orders/${editOrderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Update failed");
      }

      // Refresh
      await fetchAllOrders();
      setEditOrderId(null);
      setVendor(emptyVendor);
      setPoDetails(emptyPO);
      setItems([newItemRow(CATEGORY_DISPLAY)]);
      setView("list");
      alert("Order updated successfully.");
    } catch (err) {
      console.error("Update order err", err);
      alert("Failed to update order: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Add payment for existing order ----------
  const openAddPayment = (poId) => {
    setPaymentForOrderId(poId);
    setPaymentDetails({ paidAmount: "", paidDate: new Date().toISOString().slice(0, 10), notes: "" });
    setPaymentPopup(true);
  };

  const handleSavePaymentForExisting = async () => {
    if (!paymentForOrderId) return alert("No order selected");
    const amount = parseFloat(paymentDetails.paidAmount || 0);
    if (isNaN(amount) || amount <= 0) return alert("Enter valid amount");

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/purchase_orders/${paymentForOrderId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paidAmount: amount,
          paidDate: paymentDetails.paidDate,
          notes: paymentDetails.notes
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Add payment failed");
      }

      await fetchAllOrders();
      setPaymentPopup(false);
      setPaymentForOrderId(null);
      alert("Payment added");
    } catch (err) {
      console.error("Add payment error", err);
      alert("Failed to add payment: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate QR for all items in this PO
  async function handleGenerateQR(poId, invoiceNo) {
    try {
      setLoading(true);
      // Use existing client-side generator because it handles images/upload to storage
      const result = await generateAllQR(poId, CATEGORY_KEY, invoiceNo);
      alert(result.message);
      await fetchAllOrders(); // refresh list
    } catch (err) {
      console.error("Generate QR error:", err);
      alert("QR generation failed. Check console.");
    } finally {
      setLoading(false);
    }
  }

  function openPrintQR(poId) {
    handlePrintQR(poId); // just open popup
  }

  // OPEN PRINT POPUP (loads all QR codes of this PO) - Uses API now
  async function handlePrintQR(poId) {
    try {
      const res = await fetch(`${API_BASE}/purchase_orders/${poId}/products`);
      if (!res.ok) throw new Error("Failed to load products");
      const data = await res.json();

      setPrintPopup({
        poId,
        items: data || [],
      });
    } catch (err) {
      console.error("Print QR error:", err);
      alert("Failed to load QR codes for print.");
    }
  }

  // MARK ALL ARRIVED (auto generate QR first if missing) - Uses API
  const markAllArrived = async (poId) => {
    try {
      setLoading(true);

      const order = orders.find(o => o.Po_id === poId);
      if (order) {
        // We still use client-side generation for now as it handles images
        await generateAllQR(poId, CATEGORY_KEY, order.Po_invoice_no);
      }

      // Call backend to update status
      const res = await fetch(`${API_BASE}/purchase_orders/${poId}/mark_arrived`, {
        method: "POST"
      });

      if (!res.ok) throw new Error("Backend mark arrived failed");

      fetchAllOrders();
      alert("Arrived successfully (QR auto-generated).");
    } catch (err) {
      console.error("Mark arrived error:", err);
      alert("Failed to mark arrived.");
    } finally {
      setLoading(false);
    }
  };


  // ---------- Render UI ----------
  return (
    <div className="po-page">
      <div style={{ display: "flex", gap: 15, marginBottom: 20 }}>
        <button className="btn-primary" onClick={() => { setView("form"); setEditOrderId(null); }}>
          Add New Order
        </button>
        <button className="btn-outline" onClick={() => setView("list")}>
          Invoice List
        </button>
      </div>

      {view === "form" && (
        <>
          <h2 className="po-section-title">{CATEGORY_DISPLAY}  {editOrderId ? "Edit Purchase Order" : "Purchase Order Form"}</h2>

          <form className="po-form-wrapper" onSubmit={editOrderId ? handleUpdateOrder : handleSubmitForm}>
            <h3 className="section-heading">Vendor Information</h3>

            <div className="grid-3">
              <div className="form-field">
                <label>Vendor Name *</label>
                <input name="Vendor_name" value={vendor.Vendor_name || ""} onChange={handleVendorChange} className="form-input" />
              </div>

              <div className="form-field">
                <label>Address *</label>
                <input name="Address_line" value={vendor.Address_line || ""} onChange={handleVendorChange} className="form-input" />
              </div>

              <div className="form-field">
                <label>Location *</label>
                <input name="Address_location" value={vendor.Address_location || ""} onChange={handleVendorChange} className="form-input" />
              </div>
            </div>

            <div className="grid-4">
              <div className="form-field">
                <label>City *</label>
                <input name="Address_city" value={vendor.Address_city || ""} onChange={handleVendorChange} className="form-input" />
              </div>

              <div className="form-field">
                <label>State *</label>
                <input name="Address_state" value={vendor.Address_state || ""} onChange={handleVendorChange} className="form-input" />
              </div>

              <div className="form-field">
                <label>Country *</label>
                <input name="Country" value={vendor.Country || ""} onChange={handleVendorChange} className="form-input" />
              </div>

              <div className="form-field">
                <label>Postal Code *</label>
                <input name="Postal_code" value={vendor.Postal_code || ""} onChange={handleVendorChange} className="form-input" />
              </div>
            </div>

            <div className="form-field">
              <label>VAT Number</label>
              <input name="Vat_number" value={vendor.Vat_number || ""} onChange={handleVendorChange} className="form-input" />
            </div>

            <h3 className="section-heading">PO Details</h3>
            <div className="grid-3">
              <div className="form-field">
                <label>Invoice No</label>
                <input name="Po_invoice_no" value={poDetails.Po_invoice_no || ""} onChange={handlePoChange} className="form-input" />
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  (Alphabets will be uppercased when used for batch code; digits & symbols kept as typed)
                </div>
              </div>

              <div className="form-field">
                <label>PO Date</label>
                <input name="Po_date" type="date" value={poDetails.Po_date || ""} onChange={handlePoChange} className="form-input" />
              </div>

              <div className="form-field">
                <label>Expected Delivery</label>
                <input name="expectedDate" type="date" value={poDetails.expectedDate || ""} onChange={handlePoChange} className="form-input" />
              </div>
            </div>

            <div className="form-field">
              <label>Notes</label>
              <textarea name="Notes" rows={2} value={poDetails.Notes || ""} onChange={handlePoChange} className="form-textarea"></textarea>
            </div>

            <h3 className="section-heading">Item Details - {CATEGORY_DISPLAY}</h3>

            {items.map((row, idx) => (
              <div key={idx} className="po-card-modern">
                <div className="grid-3">
                  <div className="form-field">
                    <label>Item Name</label>
                    <input className="form-input" value={row.Item_name} onChange={(e) => handleItemChange(idx, "Item_name", e.target.value)} />
                  </div>

                  <div className="form-field">
                    <label>Category</label>
                    <input className="form-input" value={row.Category} disabled />
                  </div>

                  <div className="form-field">
                    <label>Quantity</label>
                    <input className="form-input" type="number" value={row.Quantity_ordered} onChange={(e) => handleItemChange(idx, "Quantity_ordered", e.target.value)} />
                  </div>
                </div>

                <div className="grid-3">
                  <div className="form-field">
                    <label>Colour</label>
                    <input className="form-input" value={row.Colour || ""} onChange={(e) => handleItemChange(idx, "Colour", e.target.value)} />
                  </div>

                  <div className="form-field">
                    <label>Unit Price</label>
                    <input className="form-input" type="number" value={row.Unit_price} onChange={(e) => handleItemChange(idx, "Unit_price", e.target.value)} />
                  </div>

                  <div className="form-field">
                    <label>Total Price</label>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input className="form-input" value={Number(row.Total_price || 0).toFixed(2)} readOnly />
                      {idx === 0 && (
                        <select
                          className="form-input"
                          style={{ maxWidth: 150 }}
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                        >
                          {currencyOptions.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.label} ({c.code}) {c.symbol}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                      {formatCurrency(row.Total_price, currency)}
                      {idx === 0 && " (applies to all totals)"}
                    </div>
                  </div>
                </div>

                <div className="grid-3">
                  <div className="form-field">
                    <label>Size (L x T x H)</label>
                    <div className="size-mini-group">
                      <input type="number" placeholder="L (Width)" value={row.Width || ""} onChange={(e) => handleItemChange(idx, "Width", e.target.value)} />
                      <input type="number" placeholder="T (Thickness)" value={row.Thickness || ""} onChange={(e) => handleItemChange(idx, "Thickness", e.target.value)} />
                      <input type="number" placeholder="H (Height)" value={row.Height || ""} onChange={(e) => handleItemChange(idx, "Height", e.target.value)} />
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: 'wrap' }}>
                    {row.Batch_created ? (
                      <div style={{ fontSize: 12, color: "#2d6a4f" }}>Batch created</div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#666" }}>Batch not created</div>
                    )}
                    <button type="button" className="btn-outline" onClick={() => removeItemRow(idx)} disabled={row.Batch_created}>Remove Item</button>
                  </div>
                </div>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <div className="grand-total-box" style={{ margin: 0 }}>
                <div className="grand-total-label">Grand Total</div>
                <div className="grand-total-value">{formatCurrency(grandTotal, currency)}</div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button type="button" className="btn-outline" onClick={addItemRow}>
                  + Add Item
                </button>
                <button type="submit" className="btn-primary grand-submit-btn">
                  {editOrderId ? "Update Order" : "Submit & Continue to Payment"}
                </button>
              </div>
            </div>
          </form>
        </>
      )}

      {/* PAYMENT POPUP */}
      {paymentPopup && (
        <div className="payment-modal-overlay">
          <div className="payment-modal-card">
            <div className="payment-left">
              <div className="payment-icon"></div>
              <h2>Payment Details</h2>
              <p>Enter paid amount (date prefilled). Payment status will update automatically.</p>
            </div>

            <div className="payment-right">
              <div className="po-field">
                <label>Paid Amount</label>
                <input
                  type="number"
                  name="paidAmount"
                  min="0"
                  step="0.01"
                  placeholder="Enter amount ( total)"
                  value={paymentDetails.paidAmount}
                  onChange={(e) =>
                    setPaymentDetails((p) => ({ ...p, paidAmount: e.target.value }))
                  }
                />

              </div>

              <div className="po-field">
                <label>Paid Date</label>
                <input type="date" name="paidDate" value={paymentDetails.paidDate} onChange={(e) => setPaymentDetails((p) => ({ ...p, paidDate: e.target.value }))} />
              </div>

              <div className="po-field">
                <label>Notes</label>
                <textarea rows="2" name="notes" value={paymentDetails.notes} onChange={(e) => setPaymentDetails((p) => ({ ...p, notes: e.target.value }))}></textarea>
              </div>

              <div className="payment-buttons">
                <button className="btn-cancel" onClick={() => { setPaymentPopup(false); window.__poDraft = null; }}>Cancel</button>
                <button className="btn-submit" onClick={paymentForOrderId ? handleSavePaymentForExisting : handleSavePayment}>Save Payment & Submit</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIST VIEW */}
      {view === "list" && (
        <div className="po-list-card">
          <h2 className="po-section-title">Invoice List  {CATEGORY_DISPLAY}</h2>

          {loading ? (
            <p>Loading</p>
          ) : orders.length === 0 ? (
            <p>No orders yet.</p>
          ) : (
            <div className="po-table-block">
              <table className="po-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Vendor</th>
                    <th>Items (Category)</th>
                    <th>Batch Code / Item Index</th>
                    <th>Item Count</th>
                    <th>Total Qty</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Balance</th>
                    <th>Arrival</th>
                    <th>Payment Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {pagedOrders.map((order) => {
                    const itemCount = order.Items.length;
                    // QR Generated = any PO item in this category has Batch_created = true 
                    const qrGenerated = (order.Items || []).some(
                      (it) => (it.Category || "").toLowerCase() === CATEGORY_KEY && it.Batch_created
                    );

                    // Mark Arrived also means QR exists
                    const markArrived = order.Items.every((it) => it.Arrival_status === "Arrived");

                    const totalQty = order.Items.reduce((s, it) => s + (parseFloat(it.Quantity_ordered) || 0), 0);
                    const arrival = order.Items.every((it) => it.Arrival_status === "Arrived")
                      ? "All Arrived"
                      : order.Items.some((it) => it.Arrival_status === "Arrived")
                        ? "Partially Arrived"
                        : "Ordered";
                    const paid = (order.Payments || []).reduce((s, p) => s + (parseFloat(p.Amount) || 0), 0);
                    const balance = Math.max((order.TotalAmount || 0) - paid, 0);
                    const payStatus = getPaymentStatus(paid, order.TotalAmount || 0);

                    // Find items in this order that match the active category (case-insensitive)
                    const categoryItems = (order.Items || []).filter((it) => ((it.Category || "").toLowerCase() === CATEGORY_KEY));
                    let exampleBatch = "-";
                    if (categoryItems.length) {
                      // prefer existing Batch_code if present
                      exampleBatch = categoryItems[0].Batch_code || makeBatchCode(PREFIX, order.Po_invoice_no, order.Items.findIndex((it) => it.Po_item_id === categoryItems[0].Po_item_id) + 1);
                    } else {
                      // fallback generate from PO (shouldn't happen as list is filtered)
                      exampleBatch = makeBatchCode(PREFIX, order.Po_invoice_no, 1);
                    }

                    const disableAddPayment = payStatus === "Full Paid";

                    return (
                      <tr key={order.Po_id}>
                        <td>{order.Po_invoice_no}</td>
                        <td>{order.Vendor ? order.Vendor.Vendor_name : "-"}</td>
                        <td>{categoryItems?.[0]?.Category || "-"}</td>
                        <td style={{ fontSize: 12 }}>{exampleBatch}</td>
                        <td>{itemCount}</td>
                        <td>{totalQty}</td>
                        <td>{formatCurrency(order.TotalAmount || 0, currency)}</td>
                        <td>{formatCurrency(paid, currency)}</td>
                        <td>{formatCurrency(balance, currency)}</td>
                        <td>{arrival}</td>
                        <td>{payStatus}</td>
                        <td className="po-actions-cell">
                          <button className="po-action-btn" onClick={() => setViewOrderId(order.Po_id)}>View</button>
                          <button
                            className="po-action-btn"
                            onClick={() => openAddPayment(order.Po_id)}
                            disabled={disableAddPayment}
                            style={{ opacity: disableAddPayment ? 0.5 : 1 }}
                          >
                            Add Payment
                          </button>

                          <button className="po-action-btn" onClick={() => handleEditOrder(order.Po_id)}>Edit</button>
                          <button
                            className="po-action-btn"
                            disabled={qrGenerated || markArrived}
                            style={{ opacity: qrGenerated || markArrived ? 0.5 : 1 }}
                            onClick={() => !qrGenerated && !markArrived && handleGenerateQR(order.Po_id, order.Po_invoice_no)}
                          >
                            {qrGenerated || markArrived ? "Barcode Generated" : "Generate Barcode"}

                          </button>

                          <button
                            className="po-action-btn"
                            disabled={!qrGenerated}
                            style={{ opacity: !qrGenerated ? 0.5 : 1 }}
                            onClick={() => qrGenerated && openPrintQR(order.Po_id)}
                          >
                            Print Barcode
                          </button>



                          {arrival !== "All Arrived" && (
                            <button className="po-action-btn" onClick={() => markAllArrived(order.Po_id)}>Mark All Arrived</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="po-pagination">
                <span className="po-page-info">
                  Page {safePage} of {totalPages}
                </span>
                <div className="po-page-buttons">
                  <button
                    type="button"
                    onClick={() => goToPage(safePage - 1)}
                    disabled={safePage === 1}
                    className="po-page-btn"
                  >
                    Prev
                  </button>
                  <span className="po-page-current">{safePage}</span>
                  <button
                    type="button"
                    onClick={() => goToPage(safePage + 1)}
                    disabled={safePage === totalPages}
                    className="po-page-btn"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW INVOICE POPUP */}
      {viewOrderId && (
        <div className="payment-modal-overlay">
          <div className="invoice-modal-card">
            {(() => {
              const order = orders.find((o) => o.Po_id === viewOrderId);
              if (!order) return <div>Not found</div>;

              const paid = (order.Payments || []).reduce((s, p) => s + (parseFloat(p.Amount) || 0), 0);

              return (
                <>
                  <div className="invoice-header">
                    <div>
                      <h3>Invoice #{order.Po_invoice_no}</h3>
                      <p className="invoice-sub">Vendor: {order.Vendor?.Vendor_name || "-"}</p>
                    </div>
                    <button className="invoice-close-btn" onClick={() => setViewOrderId(null)}></button>
                  </div>

                  <div className="invoice-meta">
                    <div><span className="invoice-meta-label">PO Date:</span> {order.Po_date || "-"}</div>
                    <div><span className="invoice-meta-label">Location:</span> {order.Vendor?.Address_city || "-"}, {order.Vendor?.Country || "-"}</div>
                  </div>

                  <div className="invoice-summary-row">
                    <div className="invoice-summary-card"><span>Total Amount</span><strong>{formatCurrency(order.TotalAmount || 0, currency)}</strong></div>
                    <div className="invoice-summary-card"><span>Paid</span><strong>{formatCurrency(paid, currency)}</strong></div>
                    <div className="invoice-summary-card"><span>Balance</span><strong>{formatCurrency(Math.max((order.TotalAmount || 0) - paid, 0), currency)}</strong></div>
                    <div className="invoice-summary-card">
                      <span>Status</span>
                      <strong>{getPaymentStatus(paid, order.TotalAmount)}</strong>
                    </div>
                  </div>

                  <h4 className="invoice-section-title">Items</h4>
                  <div className="invoice-items-wrapper">
                    <table className="po-table invoice-items-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Item</th>
                          <th>Qty</th>
                          <th>Colour</th>
                          <th>Size</th>
                          <th>Unit Price</th>
                          <th>Total</th>
                          <th>Arrival</th>
                          <th>Batch Created</th>
                          <th>Batch Code</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.Items.map((it, i) => {
                          const idx = i + 1;
                          // If Batch_code exists we show it. Otherwise we compute a best-effort code for display.
                          const displayBatch = it.Batch_code || makeBatchCode(PREFIX, order.Po_invoice_no, idx);
                          return (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td>{it.Item_name} <div style={{ fontSize: 11, color: "#666" }}>{displayBatch}</div></td>
                              <td>{it.Quantity_ordered}</td>
                              <td>{it.Colour || "-"}</td>
                              <td>{formatSize(it.Height, it.Width, it.Thickness)}</td>
                              <td>{formatCurrency(it.Unit_price, currency)}</td>
                              <td>{formatCurrency(it.Total_price, currency)}</td>
                              <td>{it.Arrival_status}</td>
                              <td>{it.Batch_created ? "Yes" : "No"}</td>
                              <td>{it.Batch_code || "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <h4 className="invoice-section-title">Payment History</h4>
                  {order.Payments && order.Payments.length > 0 ? (
                    <ul className="invoice-payments-list">
                      {order.Payments.map((p, idx) => (
                        <li key={idx}><span>{p.Payment_date}  {formatCurrency(p.Amount, currency)} ({p.Payment_id})</span>{p.Notes && <span className="invoice-payment-note"> {p.Notes}</span>}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="invoice-no-payments">No payments added yet.</p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
      {/* PRINT BARCODE POPUP */}
      {/* PRINT BARCODE POPUP */}
      {printPopup && (
        <div className="payment-modal-overlay">
          <div className="invoice-modal-card" style={{ maxWidth: "900px" }}>
            <div className="invoice-header">
              <h3>Print Barcodes</h3>
              <button
                className="invoice-close-btn"
                onClick={() => setPrintPopup(null)}
              >

              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: "15px",
                padding: "10px",
              }}
            >
              {printPopup.items.map((it, idx) => (
                <div
                  key={idx}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: 10,
                    textAlign: "center",
                    background: "#fff",
                  }}
                >
                  {/* BARCODE IMAGE */}
                  <img
                    src={it.Qr_image_url}
                    alt={it.Barcode_short}
                    style={{ width: "140px", height: "80px", objectFit: "contain" }}
                  />

                  {/* SHORT BARCODE (scanned by the reader) */}
                  <p style={{ marginTop: 6, fontSize: "13px", fontWeight: 600 }}>
                    {it.Barcode_short}
                  </p>

                  {/* FULL ITEM ID */}
                  <p style={{ marginTop: 4, fontSize: "12px", color: "#555" }}>
                    {it.Item_id}
                  </p>

                  {/* BATCH CODE */}
                  <p style={{ marginTop: 4, fontSize: "12px", color: "#777" }}>
                    {it.Batch_code}
                  </p>

                  <button
                    className="po-action-btn"
                    onClick={() => window.open(it.Qr_image_url)}
                  >
                    Print Single
                  </button>
                </div>
              ))}
            </div>

            <div style={{ textAlign: "right", padding: 10 }}>
              <button className="po-action-btn" onClick={() => window.print()}>
                Print All
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
