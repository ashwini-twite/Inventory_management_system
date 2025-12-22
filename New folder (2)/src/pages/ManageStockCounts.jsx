import React, { useEffect, useMemo, useState } from "react";
import "../styles/manageStock.css";
// import { supabase } from "../supabaseClient"; // REMOVED

const API_BASE = "http://127.0.0.1:8000";

export default function ManageStockCounts() {
  const [activeTab, setActiveTab] = useState("Monuments");
  const [searchDraft, setSearchDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [batches, setBatches] = useState([]);
  const [viewBatch, setViewBatch] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAllCounts();

    const handler = () => loadAllCounts();
    window.addEventListener("stock-updated", handler);

    return () => window.removeEventListener("stock-updated", handler);
  }, [activeTab]);

  async function loadAllCounts() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/stock/counts?category=${activeTab}`);
      if (!res.ok) throw new Error("Failed to fetch stock counts");
      const data = await res.json();
      setBatches(data);
    } catch (err) {
      console.error("Load counts error:", err);
      // alert("Failed to load stock counts.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();

    return batches.filter((b) => {
      const matchTerm = !term
        ? true
        : [
          b.batchCode,
          b.idRange,
          b.category,
          b.productName,
          b.size,
          b.colour,
          b.quantity,
          b.out,
          b.sold,
          b.returned,
          b.available,
          b.arrivalDate,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);

      return matchTerm;
    });
  }, [batches, searchTerm]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchTerm(searchDraft.trim());
  };

  const clearFilters = () => {
    setSearchDraft("");
    setSearchTerm("");
  };

  return (
    <div className="ms-page">
      <h2 className="ms-title">Stock Counts</h2>

      <div className="tab-bar">
        {["Monuments", "Granite", "Quartz"].map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="ms-card">
        <form
          className="ms-filters"
          onSubmit={handleSearch}
          style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
        >
          <input
            className="form-input"
            type="text"
            placeholder="Search stock counts..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
          />

          <button className="ms-btn">Search</button>
          <button
            className="ms-btn-outline"
            type="button"
            onClick={clearFilters}
          >
            Clear
          </button>
        </form>

        <div className="table-wrap">
          <table className="ms-table">
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
                <th>Arrival</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan="13">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="13">No stock found.</td></tr>
              ) : (
                filtered.map((b, idx) => (
                  <tr key={idx}>
                    <td>{b.batchCode}</td>
                    <td>{b.idRange}</td>
                    <td>{b.category}</td>
                    <td>{b.productName}</td>
                    <td>{b.size}</td>
                    <td>{b.colour}</td>
                    <td>{b.quantity}</td>
                    <td>{b.out}</td>
                    <td>{b.sold}</td>
                    <td>{b.returned}</td>

                    <td className={b.available > 0 ? "success" : "danger"}>
                      {b.available}
                    </td>

                    <td>{b.arrivalDate}</td>

                    <td>
                      <button className="ms-btn" onClick={() => setViewBatch(b)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewBatch && (
        <div className="ms-modal-overlay">
          <div className="ms-modal-wide">
            <div className="ms-modal-header">
              <h3>Batch Details - {viewBatch.batchCode}</h3>
              <button className="close-btn" onClick={() => setViewBatch(null)}>
                x
              </button>
            </div>

            <h4>Items in this batch</h4>

            <table className="ms-table small">
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
                {viewBatch.items.map((p) => (
                  <tr key={p.Stock_id}>
                    <td>{p.Item_id}</td>
                    <td>{p.Category || viewBatch.category || "-"}</td>
                    <td>{viewBatch.productName}</td>
                    <td>{p.Size || "-"}</td>
                    <td>
                      {Array.isArray(p.Purchase_order_items)
                        ? p.Purchase_order_items[0]?.Colour || "-"
                        : p.Purchase_order_items?.Colour || "-"}
                    </td>
                    <td>{p.Status}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              className="ms-btn-outline"
              onClick={() => setViewBatch(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
