import React, { useState, useEffect, useRef } from "react";
import "../styles/scanpage.css";
// import { supabase } from "../supabaseClient"; // REMOVED
// import { markOut, returnBefore, returnAfter } from "../services/stockActions"; // REMOVED

import { BrowserMultiFormatReader } from "@zxing/browser";

const API_BASE = "http://127.0.0.1:8000";

export default function Deliverystockscanpage() {
  const [scanType, setScanType] = useState("single");
  const [mode, setMode] = useState("");
  const [qr, setQr] = useState("");

  const [scannedProduct, setScannedProduct] = useState(null);
  const [bulkList, setBulkList] = useState([]);

  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [doNo, setDoNo] = useState("");

  const [returnPopup, setReturnPopup] = useState(null);

  const videoRef = useRef(null);
  const codeReader = useRef(null);

  const lastScannedRef = useRef({ value: null, timestamp: 0 });

  /* ---------------- LOAD CLIENTS ---------------- */
  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    try {
      const res = await fetch(`${API_BASE}/clients/`);
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (err) {
      console.error("Failed to load clients", err);
    }
  }

  /* ---------------- CLEANUP ---------------- */
  useEffect(() => {
    return () => {
      if (codeReader.current) {
        try {
          codeReader.current.stopContinuousDecode();
        } catch { }
      }
    };
  }, []);

  /* ---------------- CAMERA START ---------------- */
  async function startCamera() {
    setMode("camera");

    if (codeReader.current) {
      try {
        codeReader.current.stopContinuousDecode();
      } catch { }
    }

    codeReader.current = new BrowserMultiFormatReader();

    if (videoRef.current) {
      videoRef.current.setAttribute("autoplay", true);
      videoRef.current.setAttribute("muted", true);
      videoRef.current.setAttribute("playsinline", true);
    }

    const constraints = {
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;

      await codeReader.current.decodeFromVideoElement(
        videoRef.current,
        (result) => {
          if (result) handleQRScan(result.getText());
        }
      );
    } catch (err) {
      console.error("Decode fail:", err);
    }
  }

  /* ---------------- STOP CAMERA ---------------- */
  function stopCamera() {
    if (codeReader.current) {
      try {
        codeReader.current.stopContinuousDecode();
      } catch { }
    }
    setMode("");
  }

  /* ---------------- PROCESS BARCODE ---------------- */
  async function handleQRScan(code) {
    if (!code) return;

    const now = Date.now();
    const last = lastScannedRef.current;

    if (last.value === code && now - last.timestamp < 800) return;
    lastScannedRef.current = { value: code, timestamp: now };

    const clean = String(code).trim().toUpperCase();
    setQr(clean);

    try {
      // API LOOKUP
      const res = await fetch(`${API_BASE}/scan/barcode/${encodeURIComponent(clean)}`);
      if (!res.ok) {
        console.error("Lookup failed");
        return;
      }

      const product = await res.json();

      if (!product) {
        alert("Barcode not found!");
        return;
      }

      /* -------- RETURN LOGIC -------- */
      if (product.Status === "Out") {
        stopCamera();
        setReturnPopup({ product: product, type: "before" });
        return;
      }

      if (product.Status === "Sold") {
        stopCamera();
        setReturnPopup({ product: product, type: "after" });
        return;
      }

      /* -------- SINGLE SCAN -------- */
      if (scanType === "single") {
        setScannedProduct({ ...product, Status: "Scanned" });
        stopCamera();
        return;
      }

      /* -------- BULK SCAN -------- */
      setBulkList((prev) => {
        if (prev.some((x) => x.Item_id === product.Item_id)) return prev;
        return [...prev, { ...product, uid: Date.now() + Math.random() }];
      });

    } catch (err) {
      console.error("Scan processing error", err);
      alert("Error processing scan");
    }
  }

  /* ---------------- CONFIRM RETURN ---------------- */
  async function confirmReturnFromScan() {
    if (!returnPopup) return;
    const { product, type } = returnPopup;

    const reason = window.prompt("Reason for return?") || "";

    try {
      const res = await fetch(`${API_BASE}/scan/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stock_id: product.Stock_id,
          reason: reason,
          type: type
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Return failed");
      }

      alert("Item marked as returned.");
      setReturnPopup(null);
      setQr("");
    } catch (err) {
      console.error("Return error:", err);
      alert(`Failed to process return: ${err.message}`);
    }
  }

  /* ---------------- SINGLE SUBMIT ---------------- */
  async function submitSingle() {
    if (!scannedProduct) return alert("No product scanned");
    if (!selectedClientId) return alert("Select a client");
    if (!doNo) return alert("Enter DO number");

    try {
      const res = await fetch(`${API_BASE}/scan/mark_out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stock_id: scannedProduct.Stock_id,
          client_id: selectedClientId,
          do_no: doNo,
          mode: "Single Scan"
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Mark out failed");
      }

      stopCamera();
      alert("Item marked OUT.");

      setScannedProduct(null);
      setQr("");
      setSelectedClientId(null);
      setDoNo("");
      lastScannedRef.current = { value: null, timestamp: 0 };

    } catch (err) {
      console.error("Submit error", err);
      alert(`Failed to submit: ${err.message}`);
    }
  }

  /* ---------------- BULK SUBMIT ---------------- */
  async function submitBulk() {
    if (bulkList.length === 0) return alert("No items scanned");
    if (!selectedClientId) return alert("Select a client");
    if (!doNo) return alert("Enter DO number");

    try {
      for (const item of bulkList) {
        const res = await fetch(`${API_BASE}/scan/mark_out`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stock_id: item.Stock_id,
            client_id: selectedClientId,
            do_no: doNo,
            mode: "Bulk Scan"
          })
        });
        if (!res.ok) console.warn("Failed to mark out item", item.Item_id);
      }

      alert("Bulk items processed.");

      setBulkList([]);
      setQr("");
      setSelectedClientId(null);
      setDoNo("");
      lastScannedRef.current = { value: null, timestamp: 0 };

    } catch (err) {
      console.error("Bulk submit error", err);
      alert("One or more items failed to process.");
    }
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="scan-wrapper">
      <div className="scan-header-bar">
        <h2 className="scan-title">Delivery Stock Scan</h2>

        <div className="scan-toggle">
          <button
            className={scanType === "single" ? "toggle-active" : ""}
            onClick={() => {
              setScanType("single");
              setBulkList([]);
            }}
          >
            Single scan
          </button>

          <button
            className={scanType === "bulk" ? "toggle-active" : ""}
            onClick={() => {
              setScanType("bulk");
              setScannedProduct(null);
            }}
          >
            Bulk scan
          </button>
        </div>
      </div>

      {/* SCAN CARD */}
      <div className="scan-card">
        <h3 className="section-title">Scan your Barcode</h3>

        <div className="scan-mode-buttons">
          <button
            className={mode === "camera" ? "mode-active" : ""}
            onClick={startCamera}
          >
            Camera
          </button>

          <button
            className={mode === "manual" ? "mode-active" : ""}
            onClick={() => {
              stopCamera();
              setMode("manual");
            }}
          >
            Manual Entry
          </button>
        </div>

        {/* MANUAL ENTRY */}
        {mode === "manual" && (
          <div className="manual-input-wrap">
            <input
              className="manual-input"
              type="text"
              placeholder="Enter barcode"
              value={qr}
              onChange={(e) => setQr(e.target.value)}
            />
            <button className="save-btn" onClick={() => handleQRScan(qr)}>
              Save scan
            </button>
          </div>
        )}

        {/* CAMERA MODE */}
        {mode === "camera" && (
          <div className="camera-box-ui">
            <video
              ref={videoRef}
              className="camera-preview"
              autoPlay
              muted
              playsInline
            />

            <div className="camera-controls">
              <button className="cam-btn blue" onClick={startCamera}>
                Restart camera
              </button>

              <button className="cam-btn" onClick={stopCamera}>
                Stop camera
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SINGLE RESULT */}
      {scanType === "single" && scannedProduct && (
        <>
          <div className="product-card-ui">
            <h3 className="section-title">Product details</h3>

            <div className="product-grid">
              <div className="prod-field">
                <label>Batch Code</label>
                <span>{scannedProduct.Batch_code}</span>
              </div>
              <div className="prod-field">
                <label>Item ID</label>
                <span>{scannedProduct.Item_id}</span>
              </div>
              <div className="prod-field">
                <label>Category</label>
                <span>{scannedProduct.Category}</span>
              </div>
              <div className="prod-field">
                <label>Product Name</label>
                <span>{scannedProduct.Product_name}</span>
              </div>
              <div className="prod-field">
                <label>Size</label>
                <span>{scannedProduct.Size}</span>
              </div>
              <div className="prod-field">
                <label>Colour</label>
                <span>{scannedProduct.colour}</span>
              </div>
              <div className="prod-field">
                <label>Short Barcode</label>
                <span>{scannedProduct.Barcode_short}</span>

              </div>
            </div>
          </div>

          <div className="client-card-ui">
            <h3 className="section-title">Client selection</h3>

            <select
              className="client-select"
              value={selectedClientId || ""}
              onChange={(e) => setSelectedClientId(Number(e.target.value))}
            >
              <option value="">Select Client</option>
              {clients.map((c) => (
                <option key={c.Client_id} value={c.Client_id}>
                  {c.Client_name}
                </option>
              ))}
            </select>

            <input
              className="do-input"
              placeholder="Enter Delivery Order No"
              value={doNo}
              onChange={(e) => setDoNo(e.target.value)}
            />

            <div className="client-actions">
              <button className="submit-main" onClick={submitSingle}>
                Submit and save
              </button>
              <button
                className="reset-main"
                onClick={() => setScannedProduct(null)}
              >
                Reset
              </button>
            </div>
          </div>
        </>
      )}

      {/* BULK LIST */}
      {scanType === "bulk" && bulkList.length > 0 && (
        <>
          <div className="bulk-section">
            <h3 className="section-title">Scanned products</h3>

            <table className="bulk-table-ui">
              <thead>
                <tr>
                  <th>Batch Code</th>
                  <th>Item ID</th>
                  <th>Category</th>
                  <th>Product Name</th>
                  <th>Size</th>
                  <th>Colour</th>
                  <th>Short Code</th>
                </tr>
              </thead>

              <tbody>
                {bulkList.map((p) => (
                  <tr key={p.uid}>
                    <td>{p.Batch_code}</td>
                    <td>{p.Item_id}</td>
                    <td>{p.Category}</td>
                    <td>{p.Product_name}</td>
                    <td>{p.Size}</td>
                    <td>{p.colour}</td>
                    <td>{p.Barcode_short}</td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="client-card-ui">
            <h3 className="section-title">Client selection</h3>

            <select
              className="client-select"
              value={selectedClientId || ""}
              onChange={(e) => setSelectedClientId(Number(e.target.value))}
            >
              <option value="">Select Client</option>
              {clients.map((c) => (
                <option key={c.Client_id} value={c.Client_id}>
                  {c.Client_name}
                </option>
              ))}
            </select>

            <input
              className="do-input"
              placeholder="Enter Delivery Order No"
              value={doNo}
              onChange={(e) => setDoNo(e.target.value)}
            />

            <div className="client-actions">
              <button className="submit-main" onClick={submitBulk}>
                Submit Bulk
              </button>
              <button className="reset-main" onClick={() => setBulkList([])}>
                Reset
              </button>
            </div>
          </div>
        </>
      )}

      {/* RETURN POPUP */}
      {returnPopup && (
        <div className="scan-return-overlay">
          <div className="scan-return-modal">
            <h3>
              {returnPopup.type === "before"
                ? "Item already OUT"
                : "Item already SOLD"}
            </h3>
            <p>
              <strong>Item ID:</strong> {returnPopup.product.Item_id}
            </p>
            <p>
              <strong>Short Code:</strong> {returnPopup.product.Barcode_short}
            </p>
            <p>
              <strong>Product Name:</strong> {returnPopup.product.Product_name}
            </p>
            <p>
              <strong>Status:</strong> {returnPopup.product.Status}
            </p>

            <p style={{ marginTop: 10 }}>
              Do you want to <b>mark this item as RETURNED</b>?
            </p>

            <div className="scan-return-actions">
              <button
                className="ms-btn-outline"
                onClick={() => setReturnPopup(null)}
              >
                Cancel
              </button>
              <button className="ms-btn" onClick={confirmReturnFromScan}>
                Yes, Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
