import React, { useState, useEffect } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import "../styles/manageStock.css";
// import { supabase } from "../supabaseClient"; // REMOVED

const API_BASE = "http://127.0.0.1:8000";

export default function ManageStockProducts() {
  const [barcodePopup, setBarcodePopup] = useState(null);
  const [idPopup, setIdPopup] = useState(null);
  const [detailsPopup, setDetailsPopup] = useState(null);

  const [activeTab, setActiveTab] = useState("Monuments");
  const [searchTerm, setSearchTerm] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  /* --------------------------------------------
        AUTO LOAD
  -------------------------------------------- */
  useEffect(() => {
    fetchProducts();
    const handler = () => fetchProducts();
    window.addEventListener("stock-updated", handler);
    return () => window.removeEventListener("stock-updated", handler);
  }, [activeTab]);

  /* --------------------------------------------
        FETCH PRODUCTS
  -------------------------------------------- */
  async function fetchProducts() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/stock/products?category=${activeTab}`);
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error("Fetch Products Error:", err);
      // alert("Failed loading products");
    } finally {
      setLoading(false);
    }
  }

  /* --------------------------------------------
        BARCODE FUNCTIONS
  -------------------------------------------- */

  async function downloadSingleBarcode(item) {
    if (!item.Qr_image_url) return;
    try {
      const response = await fetch(item.Qr_image_url);
      const blob = await response.blob();
      saveAs(blob, `${item.Barcode_short}.png`);
    } catch (err) {
      console.error("Download Error", err);
    }
  }

  async function downloadAllBarcodes() {
    const zip = new JSZip();

    for (let item of barcodePopup.items) {
      if (!item.Qr_image_url) continue;
      try {
        const blob = await fetch(item.Qr_image_url).then((r) => r.blob());
        zip.file(`${item.Barcode_short}.png`, blob);
      } catch (err) {
        console.error("Zip Fetch Error", err);
      }
    }

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `${barcodePopup.batchCode}_BARCODES.zip`);
  }

  /* --------------------------------------------
        FILTER LIST
  -------------------------------------------- */
  const filteredProducts = products
    .filter((p) => {
      const term = searchTerm.toLowerCase();
      const blob = [p.batchCode, p.idRange, p.category, p.productName, p.size, p.colour]
        .join(" ")
        .toLowerCase();

      const matchTerm = !term || blob.includes(term);
      const matchAvail =
        availabilityFilter === "all"
          ? true
          : availabilityFilter === "in"
            ? p.available > 0
            : p.available <= 0;

      return matchTerm && matchAvail;
    });

  /* --------------------------------------------
        UI START
  -------------------------------------------- */
  return (
    <div className="ms-products-page">
      <div className="ms-products-header">
        <h1 className="section-title">Manage Stock</h1>
        <div className="ms-pill-tabs">
          {["Monuments", "Granite", "Quartz"].map((tab) => (
            <button
              key={tab}
              className={`ms-pill-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="ms-products-card">
        <div className="ms-products-filters">
          <input
            className="ms-products-input"
            placeholder="Search product name, batch code, availability..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="ms-products-actions">
            <button className="ms-products-btn primary" type="button">
              Search
            </button>
            <button
              className="ms-products-btn ghost"
              type="button"
              onClick={() => {
                setSearchTerm("");
                setAvailabilityFilter("all");
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {loading ? (
          <p className="ms-products-loading">Loading...</p>
        ) : (
          <div className="ms-products-table-wrap">
            <table className="ms-products-table">
              <thead>
                <tr>
                  <th>Batch Code</th>
                  <th>Item IDs</th>
                  <th>Category</th>
                  <th>Product Name</th>
                  <th>Size</th>
                  <th>Colour</th>
                  <th>Qty</th>
                  <th>Out</th>
                  <th>Sold</th>
                  <th>Return</th>
                  <th>Available</th>
                  <th>Barcode</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: "center", color: "#777" }}>
                      No data for {activeTab}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr key={p.batchId}>
                      <td>{p.batchCode}</td>
                      <td>{p.idRange}</td>
                      <td>{p.category}</td>
                      <td>{p.productName}</td>
                      <td>{p.size}</td>
                      <td>{p.colour}</td>
                      <td>{p.qty}</td>
                      <td>{p.out}</td>
                      <td>{p.sold}</td>
                      <td>{p.returned}</td>

                      <td className="ms-strong">{p.available}</td>

                      <td>
                        <span
                          className="id-range-click"
                          onClick={() =>
                            setIdPopup({
                              batchCode: p.batchCode,
                              ids: p.itemIds,
                            })
                          }
                        >
                          {p.idRange}
                        </span>
                      </td>

                      <td>
                        <button
                          className="ms-products-chip"
                          onClick={() =>
                            setBarcodePopup({
                              batchCode: p.batchCode,
                              items: p.items,
                            })
                          }
                        >
                          View Barcodes
                        </button>
                      </td>

                      <td>
                        <button
                          className="ms-products-chip outline"
                          onClick={() =>
                            setDetailsPopup({
                              batchCode: p.batchCode,
                              name: p.productName,
                              size: p.size,
                              colour: p.colour,
                              items: p.items,
                            })
                          }
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --------------------------------------------
          ID POPUP
      -------------------------------------------- */}
      {idPopup && (
        <div className="ms-modal-overlay">
          <div className="ms-modal">
            <div className="ms-modal-header">
              <h3>ID List - {idPopup.batchCode}</h3>
              <button
                onClick={() => setIdPopup(null)}
                className="popup-close-btn"
              >
                x
              </button>
            </div>

            <div className="id-list-box">
              <table className="id-table">
                <thead>
                  <tr>
                    <th>Item ID</th>
                  </tr>
                </thead>
                <tbody>
                  {idPopup.ids.map((id) => (
                    <tr key={id}>
                      <td>{id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="qr-footer">
              <button
                className="ms-btn-outline"
                onClick={() => setIdPopup(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------
          BARCODE POPUP
      -------------------------------------------- */}
      {barcodePopup && (
        <div className="ms-modal-overlay">
          <div className="ms-modal">
            <div className="ms-modal-header">
              <h3>Barcodes - {barcodePopup.batchCode}</h3>
              <button
                className="popup-close-btn"
                onClick={() => setBarcodePopup(null)}
              >
                x
              </button>
            </div>

            <div className="qr-grid">
              {barcodePopup.items.map((item) => (
                <div key={item.Stock_id} className="qr-box">
                  <img
                    src={item.Qr_image_url}
                    alt={item.Barcode_short}
                    style={{ width: 140, height: 80, objectFit: "contain" }}
                  />

                  <p style={{ marginTop: 6 }}>{item.Barcode_short}</p>
                  <p style={{ marginTop: 4, fontSize: 12 }}>{item.Item_id}</p>

                  <button
                    className="qr-single-btn"
                    onClick={() => downloadSingleBarcode(item)}
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>

            <div className="qr-footer">
              <button className="ms-btn-outline" onClick={downloadAllBarcodes}>
                Download All ZIP
              </button>

              <button className="ms-btn-primary" onClick={() => window.print()}>
                Print Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------
          DETAILS POPUP
      -------------------------------------------- */}
      {detailsPopup && (
        <div className="ms-modal-overlay">
          <div className="ms-modal">
            <div className="ms-modal-header">
              <h3>Batch Details - {detailsPopup.batchCode}</h3>
              <button
                className="popup-close-btn"
                onClick={() => setDetailsPopup(null)}
              >
                x
              </button>
            </div>

            <p>
              <b>Product Name:</b> {detailsPopup.name}
            </p>
            <p>
              <b>Size:</b> {detailsPopup.size}
            </p>
            <p>
              <b>Colour:</b> {detailsPopup.colour}
            </p>

            <div className="details-list-box">
              <table className="id-table">
                <thead>
                  <tr>
                    <th>Item ID</th>
                    <th>Category</th>
                    <th>Product Name</th>
                    <th>Size</th>
                    <th>Colour</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detailsPopup.items.map((it) => (
                    <tr key={it.Stock_id}>
                      <td>{it.Item_id}</td>
                      <td>{it.Category || "-"}</td>
                      <td>{detailsPopup.name}</td>
                      <td>{it.Size || "-"}</td>
                      <td>
                        {Array.isArray(it.Purchase_order_items)
                          ? it.Purchase_order_items[0]?.Colour || "-"
                          : it.Purchase_order_items?.Colour || "-"}
                      </td>
                      <td>{it.Status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="qr-footer">
              <button
                className="ms-btn-outline"
                onClick={() => setDetailsPopup(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
