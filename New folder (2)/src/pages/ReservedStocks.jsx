
import React, { useMemo, useState, useEffect } from "react";
import "../styles/manageStock.css";
import CategoryPills from "../components/CategoryPills";
import RowActionsMenu from "../components/RowActionsMenu";
// import { supabase } from "../supabaseClient"; // REMOVED
// import { clearReservedSale } from "../services/stockActions"; // REMOVED

const API_BASE = "http://127.0.0.1:8000";

export default function ReservedStocks() {
  const [activeTab, setActiveTab] = useState("Monuments");
  const [loading, setLoading] = useState(false);

  const [searchDraft, setSearchDraft] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const [reservedRows, setReservedRows] = useState([]);

  const [editPopup, setEditPopup] = useState(null);
  const [viewPopup, setViewPopup] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

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
    return (reservedRows || [])
      .filter((row) => {
        // 1. Category check
        if (row.category && row.category.toLowerCase() !== activeTab.toLowerCase()) return false;

        // 2. Date filter
        if (dateFilter && row.reservedDate !== dateFilter) return false;

        // 3. Universal Search
        if (searchDraft.trim()) {
          const parts = searchDraft.toLowerCase().split(/[ ,+]+/).filter(Boolean);
          const searchableText = [
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
          ].join(" ").toLowerCase();

          return parts.every(p => searchableText.includes(p));
        }

        return true;
      });
  }, [reservedRows, searchDraft, dateFilter, activeTab]);

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
      <CategoryPills value={activeTab} onChange={setActiveTab} className="tab-bar" />

      <div className="ms-card">
        {/* FILTERS */}
        <div className="list-header-row-standard">
          <div className="list-filters-standard">
            <div className="search-box-wrapper-standard">
              <input
                type="text"
                className="search-input-standard"
                placeholder="Search reserved item..."
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
              />
              {searchDraft && (
                <button className="search-clear-btn-standard" onClick={() => setSearchDraft("")}>&times;</button>
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

        {/* TABLE */}
        {loading ? (
          <p>Loading…</p>
        ) : (
          <div className="table-wrap excel-table-wrap">
            <table className="ms-table excel-table">
              <colgroup>
                <col className="excel-col-md" />
                <col className="excel-col-md" />
                <col className="excel-col-sm" />
                <col className="excel-col-lg" />
                <col className="excel-col-sm" />
                <col className="excel-col-sm" />
                <col className="excel-col-md" />
                <col className="excel-col-sm" />
                <col className="excel-col-md excel-align-center" />
                <col className="excel-col-sm" />
                <col className="excel-col-lg" />
                <col className="excel-col-actions" />
              </colgroup>
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
                  <th className="excel-align-center">Date</th>
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
                      <td className="excel-align-center">{r.reservedDate}</td>
                      <td>{r.status}</td>
                      <td>{r.remarks || <span className="muted">None</span>}</td>

                      <td className="ms-actions-cell">
                        <RowActionsMenu
                          id={`ms-reserved-${r.reservedId}`}
                          openId={openMenuId}
                          setOpenId={setOpenMenuId}
                          actions={[
                            {
                              label: "Edit",
                              onClick: () => openEditPopup(r),
                            },
                            {
                              label: "View",
                              onClick: () => setViewPopup(r),
                            },
                            {
                              label: "Clear",
                              onClick: () => clearReserved(r),
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
