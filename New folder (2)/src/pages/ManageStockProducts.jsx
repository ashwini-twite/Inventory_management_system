import React, { useState, useEffect } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import "../styles/manageStock.css";
import CategoryPills from "../components/CategoryPills";
import RowActionsMenu from "../components/RowActionsMenu";
// import { supabase } from "../supabaseClient"; // REMOVED

const API_BASE = "http://127.0.0.1:8000";

export default function ManageStockProducts() {
  const [barcodePopup, setBarcodePopup] = useState(null);
  const [idPopup, setIdPopup] = useState(null);
  const [detailsPopup, setDetailsPopup] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

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
      // 1. Availability Filter
      const matchAvail =
        availabilityFilter === "all"
          ? true
          : availabilityFilter === "in"
            ? p.available > 0
            : p.available <= 0;
      if (!matchAvail) return false;

      // 2. Universal Search
      if (searchTerm.trim()) {
        const parts = searchTerm.toLowerCase().split(/[ ,+]+/).filter(Boolean);
        const searchableText = [
          p.batchCode,
          p.idRange,
          p.category,
          p.productName,
          p.size,
          p.colour,
          p.qty,
          p.out,
          p.sold,
          p.returned,
          p.available
        ].join(" ").toLowerCase();

        return parts.every(p => searchableText.includes(p));
      }

      return true;
    });

  /* --------------------------------------------
        UI START
  -------------------------------------------- */
  return (
    <div className="ms-products-page">
      <div className="ms-products-header">
        <h1 className="section-title">Manage Stock</h1>
        <CategoryPills value={activeTab} onChange={setActiveTab} className="ms-pill-tabs" />
      </div>

      <div className="ms-products-card">
        <div className="list-header-row-standard">
          <div className="list-filters-standard">
            <div className="search-box-wrapper-standard">
              <input
                type="text"
                className="search-input-standard"
                placeholder="Search products (batch, name, size, colour...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button className="search-clear-btn-standard" onClick={() => setSearchTerm("")}>&times;</button>
              )}
            </div>

            <select
              className="ms-products-select-standard"
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              style={{ width: "auto", padding: "8px 12px", borderRadius: "10px", border: "1px solid #e2e8f0" }}
            >
              <option value="all">All Availability</option>
              <option value="in">In Stock</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="ms-products-loading">Loading...</p>
        ) : (
          <div className="ms-products-table-wrap excel-table-wrap">
            <table className="ms-products-table excel-table">
              <colgroup>
                <col className="excel-col-md" />
                <col className="excel-col-md" />
                <col className="excel-col-lg" />
                <col className="excel-col-sm" />
                <col className="excel-col-sm" />
                <col className="excel-col-xs excel-align-right" />
                <col className="excel-col-xs excel-align-right" />
                <col className="excel-col-xs excel-align-right" />
                <col className="excel-col-xs excel-align-right" />
                <col className="excel-col-xs excel-align-right" />
                <col className="excel-col-lg" />
                <col className="excel-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Batch Code</th>
                  <th>Item IDs</th>
                  <th>Product Name</th>
                  <th>Size</th>
                  <th>Colour</th>
                  <th className="excel-align-right">Qty</th>
                  <th className="excel-align-right">Out</th>
                  <th className="excel-align-right">Sold</th>
                  <th className="excel-align-right">Return</th>
                  <th className="excel-align-right">Available</th>
                  <th>Barcode</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: "center", color: "#777" }}>
                      No data for {activeTab}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr key={p.batchId}>
                      <td>{p.batchCode}</td>
                      <td>{p.idRange}</td>
                      <td>{p.productName}</td>
                      <td>{p.size}</td>
                      <td>{p.colour}</td>
                      <td className="excel-align-right">{p.qty}</td>
                      <td className="excel-align-right">{p.out}</td>
                      <td className="excel-align-right">{p.sold}</td>
                      <td className="excel-align-right">{p.returned}</td>

                      <td className="ms-strong excel-align-right">{p.available}</td>

                      <td>
                        <div style={{ display: "flex", justifyContent: "center" }}>
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
                        </div>
                      </td>

                      <td className="ms-actions-cell">
                        <RowActionsMenu
                          id={`ms-products-${p.batchId}`}
                          openId={openMenuId}
                          setOpenId={setOpenMenuId}
                          actions={[
                            {
                              label: "Details",
                              onClick: () =>
                                setDetailsPopup({
                                  batchCode: p.batchCode,
                                  name: p.productName,
                                  size: p.size,
                                  colour: p.colour,
                                  items: p.items,
                                }),
                            },
                          ]}
                        />
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

            <div className="id-list-box excel-table-wrap">
              <table className="id-table excel-table">
                <colgroup>
                  <col className="excel-col-lg" />
                </colgroup>
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
                  <div className="qr-box-inner">
                    <div className="qr-id-column">
                      <div className="qr-short-code">{item.Barcode_short}</div>
                      <div className="qr-item-id">{item.Item_id}</div>
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
                        {item.Product_name || item.productName || "-"}
                      </div>
                      <div className="qr-item-specs">
                        <span>{item.Size || item.size || "-"}</span>
                        <span className="qr-spec-separator">|</span>
                        <span>
                          {Array.isArray(item.Purchase_order_items)
                            ? item.Purchase_order_items[0]?.Colour || "-"
                            : item.Purchase_order_items?.Colour || item.Colour || item.colour || "-"}
                        </span>
                      </div>
                    </div>
                  </div>

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

            <div className="details-list-box excel-table-wrap">
              <table className="id-table excel-table">
                <colgroup>
                  <col className="excel-col-md" />
                  <col className="excel-col-lg" />
                  <col className="excel-col-sm" />
                  <col className="excel-col-sm" />
                  <col className="excel-col-sm" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Item ID</th>
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
