// CategoryInputForm.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import "../styles/purchaseOrders.css";
import { generateAllQR } from "../services/qrBatchGenerator";
import ToggleButtonGroup from "../components/ToggleButtonGroup";
import SelectMenu from "../components/SelectMenu";
import RowActionsMenu from "../components/RowActionsMenu";
import { useNav } from "../components/Layout";

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

const emptyAdditionalCharges = {
  oceanFreight: "0",
  insurance: "0",
  fumigation: "0",
  clearance: "0",
  totalSqmtOverride: "",
  landingCostOverride: "",
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
  Sqmt: "",
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
  return `${meta.code} ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

const formatSize = (height, width, thickness, sqmt, category) => {
  const cat = (category || "").toLowerCase();
  const sqmtVal = parseFloat(sqmt || 0);
  const hasSqmt = sqmtVal > 0;

  if ((cat === "granite" || cat === "quartz") && hasSqmt) {
    return `${sqmtVal.toFixed(2)} Sqmt`;
  }

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
  const { expandSidebar } = useNav();
  const CATEGORY_KEY = (catName || "monuments").toLowerCase(); // monuments | granite | quartz
  // display-friendly: Capitalized (Option B)
  const CATEGORY_DISPLAY = CATEGORY_KEY.charAt(0).toUpperCase() + CATEGORY_KEY.slice(1);
  const PREFIX = PREFIX_MAP[CATEGORY_KEY] || "MN";

  // UI state
  const [view, setView] = useState(() =>
    location.state?.view === "form" ? "form" : "list"
  ); // "list" | "form"
  const [formStep, setFormStep] = useState(1);
  const [vendor, setVendor] = useState(emptyVendor);
  const [poDetails, setPoDetails] = useState(emptyPO);
  const [items, setItems] = useState([newItemRow(CATEGORY_DISPLAY)]);
  const [currency, setCurrency] = useState("INR");
  const [additionalCharges, setAdditionalCharges] = useState(emptyAdditionalCharges);

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
  const [openMenuId, setOpenMenuId] = useState(null);
  const isSyncing = useRef(false);

  // Search/Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");




  const itemsTotal = items.reduce((s, it) => s + (parseFloat(it.Total_price) || 0), 0);
  const additionalTotal =
    (parseFloat(additionalCharges.oceanFreight) || 0) +
    (parseFloat(additionalCharges.insurance) || 0) +
    (parseFloat(additionalCharges.fumigation) || 0) +
    (parseFloat(additionalCharges.clearance) || 0);
  const grandTotal = itemsTotal + additionalTotal;
  const computedTotalSqmt = items.reduce((sum, it) => {
    const val =
      CATEGORY_KEY === "monuments"
        ? parseFloat(it.Quantity_ordered) || 0
        : parseFloat(it.Sqmt) || 0;
    return sum + val;
  }, 0);
  const totalSqmtValue =
    additionalCharges.totalSqmtOverride !== ""
      ? parseFloat(additionalCharges.totalSqmtOverride) || 0
      : computedTotalSqmt;
  const landingCostBase =
    (parseFloat(additionalCharges.oceanFreight) || 0) +
    (parseFloat(additionalCharges.insurance) || 0) +
    (parseFloat(additionalCharges.fumigation) || 0) +
    (parseFloat(additionalCharges.clearance) || 0);
  const landingCostPerSqmt = totalSqmtValue > 0 ? landingCostBase / totalSqmtValue : 0;
  const calculatedLandingCostPerSqmt = totalSqmtValue > 0 ? landingCostBase / totalSqmtValue : 0;
  const landingCostValue =
    additionalCharges.landingCostOverride !== ""
      ? parseFloat(additionalCharges.landingCostOverride) || 0
      : calculatedLandingCostPerSqmt;

  // Reset template and fetch when category changes
  useEffect(() => {
    setItems([newItemRow(CATEGORY_DISPLAY)]);
    setAdditionalCharges(emptyAdditionalCharges);
    setView(location.state?.view === "form" ? "form" : "list");
    setFormStep(1);
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

  const combinedOrders = orders.filter(o => {
    // 1. Date Filter
    if (dateFilter && o.Po_date !== dateFilter) return false;

    // 2. Search Query (Universal Search: All columns)
    if (searchQuery.trim()) {
      const parts = searchQuery.toLowerCase().split(/[ ,+]+/).filter(Boolean);

      const paidValue = (o.Payments || []).reduce((s, p) => s + (parseFloat(p.Amount) || 0), 0);
      const totalValue = o.TotalAmount || 0;
      const status = getPaymentStatus(paidValue, totalValue).toLowerCase();
      const invoice = (o.Po_invoice_no || "").toLowerCase();
      const vendorName = (o.Vendor?.Vendor_name || "").toLowerCase();
      const poDate = (o.Po_date || "").toLowerCase();
      const balanceValue = Math.max(totalValue - paidValue, 0);
      const landingCost = (o.Landing_cost ?? 0).toString();
      const itemCount = (o.Items?.length || 0).toString();
      const totalQty = (o.Items || []).reduce((s, it) => s + (parseFloat(it.Quantity_ordered) || 0), 0).toString();

      const arrivalStatus = (o.Items?.every((it) => it.Arrival_status === "Arrived")
        ? "All Arrived"
        : o.Items?.some((it) => it.Arrival_status === "Arrived")
          ? "Partially Arrived"
          : "Ordered").toLowerCase();

      // Construct a single searchable string for the entire row
      const searchableText = `${invoice} ${vendorName} ${poDate} ${status} ${arrivalStatus} ${totalValue} ${paidValue} ${balanceValue} ${landingCost} ${itemCount} ${totalQty}`.toLowerCase();

      // All parts must match somewhere in the searchable text
      return parts.every(p => searchableText.includes(p));
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(combinedOrders.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedOrders = combinedOrders.slice((safePage - 1) * pageSize, safePage * pageSize);
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
        const category = (updated.Category || "").toLowerCase();
        const qty = parseFloat(updated.Quantity_ordered) || 0;
        const unit = parseFloat(updated.Unit_price) || 0;
        const sqmt = parseFloat(updated.Sqmt) || 0;
        const width = parseFloat(updated.Width) || 0;
        const height = parseFloat(updated.Height) || 0;
        const areaSqmt = width && height ? (width * height) / 10000 : 0;
        if (category.includes("monument")) {
          updated.Total_price = qty * unit;
        } else {
          if (
            !sqmt &&
            areaSqmt &&
            (field === "Width" || field === "Height" || field === "Quantity_ordered")
          ) {
            updated.Sqmt = (areaSqmt * qty).toFixed(2);
          }
          const calcSqmt = sqmt > 0 ? sqmt : areaSqmt * qty;
          updated.Total_price = calcSqmt * unit;
        }
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

    // Check for duplicate invoice number locally
    const invoiceNo = poDetails.Po_invoice_no;
    const isDuplicate = combinedOrders.some(o =>
      o.Po_invoice_no === invoiceNo && o.Po_id !== editOrderId
    );

    if (isDuplicate) {
      alert("this invoice number already exist ..enter correct invoice number");
      return;
    }

    const cleaned = items.map((it) => {
      const category = (it.Category || "").toLowerCase();
      const qty = parseInt(it.Quantity_ordered || 0, 10);
      const unit = parseFloat(it.Unit_price || 0);
      const sqmt = parseFloat(it.Sqmt || 0);
      const width = parseFloat(it.Width || 0);
      const height = parseFloat(it.Height || 0);
      const areaSqmt = width && height ? (width * height) / 10000 : 0;
      const total = category.includes("monument")
        ? qty * unit
        : (sqmt > 0 ? sqmt : areaSqmt * qty) * unit;
      return {
        ...it,
        Quantity_ordered: qty,
        Unit_price: unit,
        Total_price: parseFloat((total || 0).toFixed(2)),
        Batch_created: !!it.Batch_created,
        Batch_code: it.Batch_code || null,
      };
    });

    window.__poDraft = {
      vendorDraft: vendor,
      poDraft: {
        ...poDetails,
        currency: currency,
        Ocean_freight: parseFloat(additionalCharges.oceanFreight) || 0,
        Insurance: parseFloat(additionalCharges.insurance) || 0,
        Fumigation: parseFloat(additionalCharges.fumigation) || 0,
        Clearance: parseFloat(additionalCharges.clearance) || 0,
        Total_sqmt: totalSqmtValue || 0,
        Landing_cost: landingCostValue || 0,
      },
      itemsDraft: cleaned,
      additionalCharges: {
        oceanFreight: parseFloat(additionalCharges.oceanFreight) || 0,
        insurance: parseFloat(additionalCharges.insurance) || 0,
        fumigation: parseFloat(additionalCharges.fumigation) || 0,
        clearance: parseFloat(additionalCharges.clearance) || 0,
      },
      totalAmount: cleaned.reduce((s, x) => s + (x.Total_price || 0), 0) + additionalTotal,
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
          notes: paymentDetails.notes,
          currency: currency
        }
      };

      const res = await fetch(`${API_BASE}/purchase_orders/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        // If it's a 500 error that looks like a network/database connection issue, trigger offline cache
        const detail = String(errData.detail || "");
        if (res.status === 500 && (detail.includes("getaddrinfo") || detail.includes("connection") || detail.includes("network"))) {
          throw new NetworkError(detail);
        }
        throw new Error(errData.detail || "Save failed");
      }

      // Reset UI after success
      clearForm();
      await fetchAllOrders();
      setView("list");
    } catch (err) {
      console.error("Save PO error:", err);
      alert("Failed to save order. " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper class for network errors
  class NetworkError extends Error {
    constructor(message) {
      super(message);
      this.name = "NetworkError";
    }
  }

  const clearForm = () => {
    setVendor(emptyVendor);
    setPoDetails(emptyPO);
    setItems([newItemRow(CATEGORY_DISPLAY)]);
    setAdditionalCharges(emptyAdditionalCharges);
    setPaymentPopup(false);
    window.__poDraft = null;
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
      Sqmt: it.Sqmt || "",
      Unit_price: it.Unit_price || 0,
      Total_price: it.Total_price || 0,
      Arrival_status: it.Arrival_status || "ordered",
      Batch_created: !!it.Batch_created,
      Batch_code: it.Batch_code || null,
      Edit_count: it.Edit_count || 0,
    }));

    setItems(mappedItems.length ? mappedItems : [newItemRow(CATEGORY_DISPLAY)]);
    setAdditionalCharges({
      ...emptyAdditionalCharges,
      oceanFreight: String(ord.Ocean_freight ?? emptyAdditionalCharges.oceanFreight),
      insurance: String(ord.Insurance ?? emptyAdditionalCharges.insurance),
      fumigation: String(ord.Fumigation ?? emptyAdditionalCharges.fumigation),
      clearance: String(ord.Clearance ?? emptyAdditionalCharges.clearance),
      totalSqmtOverride: ord.Total_sqmt ? String(ord.Total_sqmt) : "",
      landingCostOverride: ord.Landing_cost ? String(ord.Landing_cost) : "",
    });
    setCurrency(ord.currency || "INR");
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
        poDetails: {
          ...poDetails,
          currency: currency,
          Ocean_freight: parseFloat(additionalCharges.oceanFreight) || 0,
          Insurance: parseFloat(additionalCharges.insurance) || 0,
          Fumigation: parseFloat(additionalCharges.fumigation) || 0,
          Clearance: parseFloat(additionalCharges.clearance) || 0,
          Total_sqmt: totalSqmtValue || 0,
          Landing_cost: landingCostValue || 0,
        },
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
      setAdditionalCharges(emptyAdditionalCharges);
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
          notes: paymentDetails.notes,
          currency: currency
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
      <ToggleButtonGroup
        activeValue={view}
        options={[
          {
            value: "form",
            label: "Add New Order",
            onClick: () => {
              setView("form");
              setEditOrderId(null);
            },
          },
          {
            value: "list",
            label: "Invoice List",
            onClick: () => setView("list"),
          },
        ]}
      />

      {view === "form" && (
        <>
          <h2 className="po-section-title">{CATEGORY_DISPLAY}  {editOrderId ? "Edit Purchase Order" : "Purchase Order Form"}</h2>

          <form className="po-form-wrapper" onSubmit={editOrderId ? handleUpdateOrder : handleSubmitForm}>
            <div className="po-step-indicator">
              {["Vendor Info", "PO Details", "Item Details"].map((label, index) => {
                const step = index + 1;
                return (
                  <div
                    key={label}
                    className={`po-step-label ${formStep === step ? "active" : "inactive"}`}
                  >
                    {label}
                  </div>
                );
              })}
            </div>

            {formStep === 1 && (
              <div className="po-step-panel">
                <div className="po-step-card">
                  <h3 className="section-heading">Vendor Information</h3>

                  <div className="grid-3">
                    <div className="form-field">
                      <label>Vendor Name *</label>
                      <input name="Vendor_name" value={vendor.Vendor_name || ""} onChange={handleVendorChange} className="form-input" />
                    </div>

                    <div className="form-field">
                      <label>City *</label>
                      <input name="Address_city" value={vendor.Address_city || ""} onChange={handleVendorChange} className="form-input" />
                    </div>

                    <div className="form-field">
                      <label>Country *</label>
                      <input name="Country" value={vendor.Country || ""} onChange={handleVendorChange} className="form-input" />
                    </div>
                  </div>

                  <div className="grid-3">
                    <div className="form-field">
                      <label>County *</label>
                      <input name="Address_state" value={vendor.Address_state || ""} onChange={handleVendorChange} className="form-input" />
                    </div>

                    <div className="form-field">
                      <label>Postal Code *</label>
                      <input name="Postal_code" value={vendor.Postal_code || ""} onChange={handleVendorChange} className="form-input" />
                    </div>

                    <div className="form-field">
                      <label>VAT Number</label>
                      <input name="Vat_number" value={vendor.Vat_number || ""} onChange={handleVendorChange} className="form-input" />
                    </div>
                  </div>
                </div>

                <div className="po-step-actions">
                  <div />
                  <button type="button" className="btn-primary" onClick={() => setFormStep(2)}>
                    {"Next ->"}
                  </button>
                </div>
              </div>
            )}

            {formStep === 2 && (
              <div className="po-step-panel">
                <div className="po-step-card">
                  <h3 className="section-heading">PO Details</h3>
                  <div className="grid-3">
                    <div className="form-field">
                      <label>Invoice No</label>
                      <input
                        name="Po_invoice_no"
                        value={poDetails.Po_invoice_no || ""}
                        onChange={handlePoChange}
                        onBlur={(e) => {
                          const val = e.target.value;
                          if (val && combinedOrders.some(o => o.Po_invoice_no === val && o.Po_id !== editOrderId)) {
                            alert("this invoice number already exist ..enter correct invoice number");
                          }
                        }}
                        className="form-input"
                      />
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
                </div>

                <div className="po-step-actions">
                  <button type="button" className="po-secondary-btn" onClick={() => setFormStep(1)}>
                    {"<- Previous"}
                  </button>
                  <button type="button" className="btn-primary" onClick={() => setFormStep(3)}>
                    {"Next ->"}
                  </button>
                </div>
              </div>
            )}

            {formStep === 3 && (
              <div className="po-step-panel">
                <div className="po-step-card">
                  <h3 className="section-heading">Item Details</h3>

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
                            <input
                              className="form-input"
                              value={Number(row.Total_price || 0).toFixed(2)}
                              onChange={(e) => handleItemChange(idx, "Total_price", e.target.value)}
                              readOnly={!String(row.Category || "").toLowerCase().includes("monument")}
                            />
                            {idx === 0 && (
                              <SelectMenu
                                value={currency}
                                onChange={setCurrency}
                                options={currencyOptions.map((c) => ({
                                  label: `${c.label} (${c.code}) ${c.symbol}`,
                                  value: c.code,
                                }))}
                                className="select-menu--compact"
                                ariaLabel="Currency"
                              />
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
                            <input type="number" placeholder="H (Height)" value={row.Height || ""} onChange={(e) => handleItemChange(idx, "Height", e.target.value)} />
                            <input type="number" placeholder="T (Thickness)" value={row.Thickness || ""} onChange={(e) => handleItemChange(idx, "Thickness", e.target.value)} />
                          </div>
                        </div>

                        {!String(row.Category || "").toLowerCase().includes("monument") && (
                          <div className="form-field">
                            <label>Sqmt</label>
                            <input
                              className="form-input"
                              type="number"
                              placeholder="Enter Sqmt"
                              value={row.Sqmt || ""}
                              onChange={(e) => handleItemChange(idx, "Sqmt", e.target.value)}
                            />
                          </div>
                        )}

                        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}>
                          {row.Batch_created ? (
                            <div style={{ fontSize: 12, color: "#2d6a4f" }}>Batch created</div>
                          ) : (
                            <div style={{ fontSize: 12, color: "#666" }}>Batch not created</div>
                          )}
                        </div>
                      </div>

                      {idx === items.length - 1 && (
                        <div className="po-item-actions">
                          <button type="button" className="btn-outline po-outline-wide" onClick={addItemRow}>
                            + Add Item
                          </button>
                          <button
                            type="button"
                            className="btn-outline po-outline-wide"
                            onClick={() => removeItemRow(idx)}
                            disabled={row.Batch_created}
                          >
                            Remove Item
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="po-step-footer">
                    <div className="grand-total-box" style={{ margin: 0 }}>
                      <div className="grand-total-label">Subtotal</div>
                      <div className="grand-total-value">{formatCurrency(itemsTotal, currency)}</div>
                    </div>
                  </div>
                </div>

                <div className="po-step-card">
                  <h3 className="section-heading">Additional Charges</h3>
                  <div className="grid-2">
                    <div className="form-field">
                      <label>Ocean Freight</label>
                      <input
                        className="form-input"
                        type="number"
                        value={additionalCharges.oceanFreight}
                        onChange={(e) =>
                          setAdditionalCharges((prev) => ({
                            ...prev,
                            oceanFreight: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="form-field">
                      <label>Insurance</label>
                      <input
                        className="form-input"
                        type="number"
                        value={additionalCharges.insurance}
                        onChange={(e) =>
                          setAdditionalCharges((prev) => ({
                            ...prev,
                            insurance: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="form-field">
                      <label>Fumigation</label>
                      <input
                        className="form-input"
                        type="number"
                        value={additionalCharges.fumigation}
                        onChange={(e) =>
                          setAdditionalCharges((prev) => ({
                            ...prev,
                            fumigation: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="form-field">
                      <label>Clearance</label>
                      <input
                        className="form-input"
                        type="number"
                        value={additionalCharges.clearance}
                        onChange={(e) =>
                          setAdditionalCharges((prev) => ({
                            ...prev,
                            clearance: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-field">
                      <label>Total Pcs/Sqmt</label>
                      <input
                        className="form-input"
                        type="number"
                        value={
                          additionalCharges.totalSqmtOverride !== ""
                            ? additionalCharges.totalSqmtOverride
                            : computedTotalSqmt.toFixed(2)
                        }
                        onChange={(e) =>
                          setAdditionalCharges((prev) => ({
                            ...prev,
                            totalSqmtOverride: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="form-field">
                      <label>Landing Cost per Sqmt/Pcs</label>
                      <input
                        className="form-input"
                        type="number"
                        value={
                          additionalCharges.landingCostOverride !== ""
                            ? additionalCharges.landingCostOverride
                            : calculatedLandingCostPerSqmt.toFixed(2)
                        }
                        onChange={(e) =>
                          setAdditionalCharges((prev) => ({
                            ...prev,
                            landingCostOverride: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="po-step-footer">
                  <div className="grand-total-box" style={{ margin: 0 }}>
                    <div className="grand-total-label">Grand Total</div>
                    <div className="grand-total-value">{formatCurrency(grandTotal, currency)}</div>
                  </div>
                </div>

                <div className="po-step-actions">
                  <button type="button" className="po-secondary-btn" onClick={() => setFormStep(2)}>
                    {"<- Previous"}
                  </button>
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? "Saving..." : (editOrderId ? "Save Changes" : "Submit & Continue to Payment")}
                  </button>
                </div>
              </div>
            )}
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
                <button className="btn-cancel" onClick={() => { setPaymentPopup(false); window.__poDraft = null; }} disabled={loading}>Cancel</button>
                <button className="btn-submit" onClick={paymentForOrderId ? handleSavePaymentForExisting : handleSavePayment} disabled={loading}>
                  {loading ? "Saving..." : "Save Payment & Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIST VIEW */}
      {view === "list" && (
        <div className="po-list-card">
          <div className="list-header-row-standard">
            <h2 className="po-section-title">Invoice List {CATEGORY_DISPLAY}</h2>

            <div className="list-filters-standard">
              <div className="search-box-wrapper-standard">
                <input
                  type="text"
                  className="search-input-standard"
                  placeholder="Search Invoice or Status (use space, + or ,)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="search-clear-btn-standard" onClick={() => setSearchQuery("")}>&times;</button>
                )}
              </div>

              <div className="date-filter-wrapper-standard">
                <label>Filter by Date:</label>
                <input
                  type="date"
                  className="date-filter-standard"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
                {dateFilter && (
                  <button className="search-clear-btn-standard" onClick={() => setDateFilter("")}>&times;</button>
                )}
              </div>

            </div>
          </div>

          {loading ? (
            <p>Loading</p>
          ) : orders.length === 0 ? (
            <p>No orders yet.</p>
          ) : (
            <div className="po-table-block">
              <div className="excel-table-wrap">
                <table className="po-table excel-table">
                  <colgroup>
                    <col className="excel-col-md" />
                    <col className="excel-col-sm" />
                    <col className="excel-col-lg" />
                    <col className="excel-col-sm excel-align-right" />
                    <col className="excel-col-sm excel-align-right" />
                    <col className="excel-col-sm excel-align-right" />
                    <col className="excel-col-sm excel-align-right" />
                    <col className="excel-col-sm excel-align-right" />
                    <col className="excel-col-sm excel-align-right" />
                    <col className="excel-col-md" />
                    <col className="excel-col-md" />
                    <col className="excel-col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>PO Date</th>
                      <th>Vendor</th>
                      <th className="excel-align-right">Item Count</th>
                      <th className="excel-align-right">Total Qty</th>
                      <th className="excel-align-right">Total</th>
                      <th className="excel-align-right">Paid</th>
                      <th className="excel-align-right">Balance</th>
                      <th className="excel-align-right">Landing Cost</th>
                      <th>Arrival</th>
                      <th>Payment Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pagedOrders.map((order) => {
                      const landingCost =
                        order.Landing_cost ??
                        order.landing_cost ??
                        order.landingCost ??
                        order.landing_cost_per_sqmt ??
                        0;
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

                      const disableAddPayment = payStatus === "Full Paid";

                      return (
                        <tr key={order.Po_id}>
                          <td
                            className="po-invoice-click"
                            onClick={() => setViewOrderId(order.Po_id)}
                            style={{
                              cursor: "pointer",
                              color: "var(--accent-strong)",
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: "8px"
                            }}
                            title={"View invoice"}
                          >
                            {order.Po_invoice_no}
                          </td>
                          <td>{order.Po_date || "-"}</td>
                          <td>{order.Vendor ? order.Vendor.Vendor_name : "-"}</td>
                          <td className="excel-align-right">{itemCount}</td>
                          <td className="excel-align-right">{totalQty}</td>
                          <td className="excel-align-right">{formatCurrency(order.TotalAmount || 0, order.currency || "INR")}</td>
                          <td className="excel-align-right">{formatCurrency(paid, order.currency || "INR")}</td>
                          <td className="excel-align-right">{formatCurrency(balance, order.currency || "INR")}</td>
                          <td className="excel-align-right">{formatCurrency(landingCost, order.currency || "INR")}</td>
                          <td>{arrival}</td>
                          <td>{payStatus}</td>
                          <td className="po-actions-cell">
                            <RowActionsMenu
                              id={`po-${order.Po_id}`}
                              openId={openMenuId}
                              setOpenId={setOpenMenuId}
                              actions={[
                                {
                                  label: "View",
                                  onClick: () => setViewOrderId(order.Po_id),
                                },
                                {
                                  label: "Edit",
                                  onClick: () => handleEditOrder(order.Po_id),
                                },
                                {
                                  label: qrGenerated || markArrived ? "Barcode Generated" : "Generate Barcode",
                                  onClick: () => handleGenerateQR(order.Po_id, order.Po_invoice_no),
                                  disabled: qrGenerated || markArrived,
                                },
                                {
                                  label: "Print Barcode",
                                  onClick: () => openPrintQR(order.Po_id),
                                  disabled: !qrGenerated,
                                },
                                {
                                  label: "Mark as Arrived",
                                  onClick: () => markAllArrived(order.Po_id),
                                  disabled: arrival === "All Arrived",
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

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
      )
      }

      {/* VIEW INVOICE POPUP */}
      {
        viewOrderId && (
          <div className="payment-modal-overlay">
            <div className="invoice-modal-card">
              {(() => {
                const order = orders.find((o) => o.Po_id === viewOrderId);
                if (!order) return <div>Not found</div>;

                const paid = (order.Payments || []).reduce((s, p) => s + (parseFloat(p.Amount) || 0), 0);
                const landingCost =
                  order.Landing_cost ??
                  order.landing_cost ??
                  order.landingCost ??
                  order.landing_cost_per_sqmt ??
                  0;

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
                    </div>

                    <div className="invoice-summary-row">
                      <div className="invoice-summary-card"><span>Total Amount</span><strong>{formatCurrency(order.TotalAmount || 0, order.currency || "INR")}</strong></div>
                      <div className="invoice-summary-card"><span>Paid</span><strong>{formatCurrency(paid, order.currency || "INR")}</strong></div>
                      <div className="invoice-summary-card"><span>Balance</span><strong>{formatCurrency(Math.max((order.TotalAmount || 0) - paid, 0), order.currency || "INR")}</strong></div>
                      <div className="invoice-summary-card">
                        <span>Status</span>
                        <strong>{getPaymentStatus(paid, order.TotalAmount)}</strong>
                      </div>
                      <div className="invoice-summary-card">
                        <span>Landing Cost</span>
                        <strong>{formatCurrency(landingCost, order.currency || "INR")}</strong>
                      </div>
                    </div>

                    <h4 className="invoice-section-title">Items</h4>
                    <div className="invoice-items-wrapper excel-table-wrap">
                      <table className="po-table invoice-items-table excel-table">
                        <colgroup>
                          <col className="excel-col-xs excel-align-right" />
                          <col className="excel-col-lg" />
                          <col className="excel-col-lg" />
                          <col className="excel-col-xs excel-align-right" />
                          <col className="excel-col-sm" />
                          <col className="excel-col-md" />
                          <col className="excel-col-sm excel-align-right" />
                          <col className="excel-col-sm excel-align-right" />
                          <col className="excel-col-sm" />
                          <col className="excel-col-sm" />
                          <col className="excel-col-md" />
                        </colgroup>
                        <thead>
                          <tr>
                            <th className="excel-align-right">#</th>
                            <th>Item</th>
                            <th>Batch Code / Item Index</th>
                            <th className="excel-align-right">Qty</th>
                            <th>Colour</th>
                            <th>Size</th>
                            <th className="excel-align-right">Unit Price</th>
                            <th className="excel-align-right">Total</th>
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
                                <td>
                                  <div>{displayBatch}</div>
                                  <div style={{ fontSize: 11, color: "#6b7280" }}>Item {idx}</div>
                                </td>
                                <td>{it.Quantity_ordered}</td>
                                <td>{it.Colour || "-"}</td>
                                <td>{formatSize(it.Height, it.Width, it.Thickness, it.Sqmt || it.sqmt || order.Total_sqmt || order.total_sqmt, it.Category)}</td>
                                <td>{formatCurrency(it.Unit_price, order.currency || "INR")}</td>
                                <td>{formatCurrency(it.Total_price, order.currency || "INR")}</td>
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
                          <li key={idx}><span>{p.Payment_date}  {formatCurrency(p.Amount, p.currency || order.currency || "INR")} ({p.Payment_id})</span>{p.Notes && <span className="invoice-payment-note"> {p.Notes}</span>}</li>
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
        )
      }
      {/* PRINT BARCODE POPUP */}
      {/* PRINT BARCODE POPUP */}
      {
        printPopup && (
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

              <div className="qr-grid">
                {printPopup.items.map((item, idx) => (
                  <div key={idx} className="qr-box">
                    <div className="qr-box-inner">
                      <div className="qr-id-column">
                        <div className="qr-short-code">{item.Barcode_short || "-"}</div>
                        <div className="qr-item-id">{item.Item_id || "-"}</div>
                      </div>

                      <div className="qr-code-column">
                        <img
                          src={item.Qr_image_url}
                          alt={item.Barcode_short}
                          className="qr-code-image"
                        />
                      </div>

                      <div className="qr-metadata-column">
                        <div className="qr-item-name">
                          {item.Product_name || "-"}
                        </div>
                        <div className="qr-item-specs">
                          <span>{item.Size || "-"}</span>
                          <span className="qr-spec-separator">|</span>
                          <span>
                            {Array.isArray(item.Purchase_order_items)
                              ? item.Purchase_order_items[0]?.Colour || "-"
                              : item.Purchase_order_items?.Colour || item.Colour || "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="po-barcode-footer">
                <button className="po-action-btn" onClick={() => window.print()}>
                  Print All
                </button>
              </div>
            </div>
          </div>
        )
      }


    </div >
  );
}
