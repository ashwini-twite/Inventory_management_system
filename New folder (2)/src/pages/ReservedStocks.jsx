
import React, { useMemo, useState, useEffect } from "react";
import "../styles/manageStock.css";
// import { supabase } from "../supabaseClient"; // REMOVED
// import { clearReservedSale } from "../services/stockActions"; // REMOVED

const API_BASE = "http://127.0.0.1:8000";

export default function ReservedStocks() {
  const [activeTab, setActiveTab] = useState("Monuments");
  const [loading, setLoading] = useState(false);

  const [searchDraft, setSearchDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [reservedRows, setReservedRows] = useState([]);

  const [editPopup, setEditPopup] = useState(null);
  const [viewPopup, setViewPopup] = useState(null);

  /* -------------------------------------------------------
      FETCH DATA
  ------------------------------------------------------- */
  useEffect(() => {
    loadAllData();

    const handler = () => loadAllData();
    window.addEventListener("stock-updated", handler);

    return () => window.removeEventListener("stock-updated", handler);
  }, [activeTab]);

  async function loadAllData() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/stock/reserved?category=${activeTab}`);
      if (!res.ok) throw new Error("Failed to load reserved stocks");
      const data = await res.json();
      setReservedRows(data);
    } catch (err) {
      console.error("Fetch reserved error:", err);
      // alert("Failed to load reserved stocks.");
    } finally {
      setLoading(false);
    }
  }

  /* -------------------------------------------------------
      FILTER
  ------------------------------------------------------- */
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return (reservedRows || [])
      .filter((row) => {
        // Backend handles category filter, but we double check if activeTab changes rapidly
        if (row.category && row.category.toLowerCase() !== activeTab.toLowerCase()) return false;

        if (!term) return true;

        const haystack = [
          row.itemId,
          row.productName,
          row.batchCode,
          row.size,
          row.colour,
          row.clientName,
          row.doNumber,
          row.reservedDate,
          row.status,
          row.remarks,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(term);
      });
  }, [reservedRows, searchTerm, activeTab]);

  /* -------------------------------------------------------
      HANDLERS
  ------------------------------------------------------- */
  const clearSearch = () => {
    setSearchDraft("");
    setSearchTerm("");
  };
  const handleSearch = (e) => {
    e.preventDefault();
    setSearchTerm(searchDraft.trim());
  };

  const openEditPopup = (row) =>
    setEditPopup({ ...row, remarks: row.remarks }); // Copy row and ensure remarks

  async function saveRemarks() {
    if (!editPopup) return;

    const id = editPopup.reservedId;

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/stock/reserved/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: editPopup.remarks || "" })
      });

      if (!res.ok) throw new Error("Failed to update remarks");

      // Optimistic update
      setReservedRows((prev) =>
        prev.map((r) =>
          r.reservedId === id ? { ...r, remarks: editPopup.remarks } : r
        )
      );

      setEditPopup(null);
    } catch (err) {
      console.error("Remarks save error:", err);
      alert("Failed to save remarks");
    } finally {
      setLoading(false);
    }
  }

  async function clearReserved(row) {
    if (
      !window.confirm(
        "Invoice created for this item?\n\nIf yes, it will be marked as SOLD and removed from reserved."
      )
    )
      return;

    try {
      setLoading(true);

      const stockId = row.stockId; // Use stockId for the clear action as per backend

      const res = await fetch(`${API_BASE}/stock/reserved/${stockId}/clear`, {
        method: "POST"
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || errData.message || "Failed to clear");
      }

      setReservedRows((prev) =>
        prev.filter((x) => x.reservedId !== row.reservedId)
      );

      setViewPopup(null);

      // Notify other components
      window.dispatchEvent(new Event("stock-updated"));

    } catch (err) {
      console.error("Clear reserved error:", err);
      alert(`Failed to clear reservation: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  /* -------------------------------------------------------
      UI
  ------------------------------------------------------- */
  return (
    <div className="ms-page">
      <h2 className="ms-title">Reserved Stocks</h2>

      {/* TABS */}
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
        {/* FILTERS */}
        <form
          className="ms-filters"
          onSubmit={handleSearch}
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
          <input
            className="form-input"
            type="search"
            placeholder="Search reserved item..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
          />

          <button className="ms-btn" type="submit">
            Search
          </button>

          <button className="ms-btn-outline" type="button" onClick={clearSearch}>
            Clear
          </button>
        </form>

        {/* TABLE */}
        {loading ? (
          <p>Loading…</p>
        ) : (
          <div className="table-wrap">
            <table className="ms-table">
              <thead>
                <tr>
                  <th>Batch Code</th>
                  <th>Item ID</th>
                  <th>Category</th>
                  <th>Product Name</th>
                  <th>Size</th>
                  <th>Colour</th>
                  <th>Client</th>
                  <th>DO</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="12" style={{ textAlign: "center" }}>
                      No reserved items for {activeTab}
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.reservedId}>
                      <td>{r.batchCode}</td>
                      <td>{r.itemId}</td>
                      <td>{r.category}</td>
                      <td>{r.productName}</td>
                      <td>{r.size}</td>
                      <td>{r.colour}</td>
                      <td>{r.clientName}</td>
                      <td>{r.doNumber}</td>
                      <td>{r.reservedDate}</td>
                      <td>{r.status}</td>
                      <td>{r.remarks || <span className="muted">None</span>}</td>

                      <td style={{ display: "flex", gap: 6 }}>
                        <button
                          className="ms-btn"
                          onClick={() => openEditPopup(r)}
                        >
                          Edit
                        </button>
                        <button
                          className="ms-btn"
                          onClick={() => setViewPopup(r)}
                        >
                          View
                        </button>
                        <button
                          className="ms-btn-danger"
                          onClick={() => clearReserved(r)}
                        >
                          Clear
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

      {/* ----- EDIT POPUP ----- */}
      {editPopup && (
        <div className="ms-modal-overlay">
          <div className="ms-modal">
            <h3>Edit Remarks</h3>

            <textarea
              className="modal-textarea"
              rows="4"
              value={editPopup.remarks}
              onChange={(e) =>
                setEditPopup((prev) => ({
                  ...prev,
                  remarks: e.target.value,
                }))
              }
            />

            <div className="modal-buttons">
              <button
                className="ms-btn-outline"
                onClick={() => setEditPopup(null)}
              >
                Cancel
              </button>
              <button className="ms-btn" onClick={saveRemarks}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----- VIEW POPUP ----- */}
      {viewPopup && (
        <div className="ms-modal-overlay">
          <div className="ms-modal-wide">
            <div className="ms-modal-header">
              <h3>Reserved Item — {viewPopup.itemId}</h3>
              <button
                className="close-btn"
                onClick={() => setViewPopup(null)}
              >
                ✕
              </button>
            </div>

            <div className="batch-info">
              <div>
                <strong>Product Name:</strong> {viewPopup.productName}
              </div>
              <div>
                <strong>Batch Code:</strong> {viewPopup.batchCode}
              </div>
              <div>
                <strong>Category:</strong> {viewPopup.category}
              </div>
              <div>
                <strong>Size:</strong> {viewPopup.size}
              </div>
              <div>
                <strong>Colour:</strong> {viewPopup.colour}
              </div>
              <div>
                <strong>Client:</strong> {viewPopup.clientName}
              </div>
              <div>
                <strong>DO:</strong> {viewPopup.doNumber}
              </div>
              <div>
                <strong>Date:</strong> {viewPopup.reservedDate}
              </div>
              <div>
                <strong>Status:</strong> {viewPopup.status}
              </div>
              <div>
                <strong>Remarks:</strong> {viewPopup.remarks || "None"}
              </div>
            </div>

            <div style={{ textAlign: "right", marginTop: 15 }}>
              <button
                className="ms-btn-outline"
                onClick={() => setViewPopup(null)}
              >
                Close
              </button>
              <button
                className="ms-btn-danger"
                onClick={() => clearReserved(viewPopup)}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
