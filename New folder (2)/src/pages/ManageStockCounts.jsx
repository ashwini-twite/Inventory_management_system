import React, { useEffect, useMemo, useState } from "react";
import "../styles/manageStock.css";
import CategoryPills from "../components/CategoryPills";
import RowActionsMenu from "../components/RowActionsMenu";
// import { supabase } from "../supabaseClient"; // REMOVED

const API_BASE = "http://127.0.0.1:8000";

export default function ManageStockCounts() {
  const [activeTab, setActiveTab] = useState("Monuments");
  const [searchDraft, setSearchDraft] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [batches, setBatches] = useState([]);
  const [viewBatch, setViewBatch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

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
    return batches.filter((b) => {
      // 1. Date filter
      if (dateFilter && b.arrivalDate !== dateFilter) return false;

      // 2. Search filter
      if (searchDraft.trim()) {
        const parts = searchDraft.toLowerCase().split(/[ ,+]+/).filter(Boolean);
        const searchableText = [
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
        ].join(" ").toLowerCase();

        return parts.every(p => searchableText.includes(p));
      }

      return true;
    });
  }, [batches, searchDraft, dateFilter]);

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

      <CategoryPills value={activeTab} onChange={setActiveTab} className="tab-bar" />

      <div className="ms-card">
        <div className="list-header-row-standard">
          <div className="list-filters-standard">
            <div className="search-box-wrapper-standard">
              <input
                type="text"
                className="search-input-standard"
                placeholder="Search stock counts..."
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

        <div className="table-wrap excel-table-wrap">
          <table className="ms-table excel-table">
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
              <col className="excel-col-md excel-align-center" />
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
                <th className="excel-align-center">Arrival</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan="12">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="12">No stock found.</td></tr>
              ) : (
                filtered.map((b, idx) => (
                  <tr key={idx}>
                    <td>{b.batchCode}</td>
                    <td>
                      <button
                        type="button"
                        className="ms-link-btn"
                        onClick={() => setViewBatch(b)}
                      >
                        {b.idRange}
                      </button>
                    </td>
                    <td>{b.productName}</td>
                    <td>{b.size}</td>
                    <td>{b.colour}</td>
                    <td className="excel-align-right">{b.quantity}</td>
                    <td className="excel-align-right">{b.out}</td>
                    <td className="excel-align-right">{b.sold}</td>
                    <td className="excel-align-right">{b.returned}</td>

                    <td className={`${b.available > 0 ? "success" : "danger"} excel-align-right`}>
                      {b.available}
                    </td>

                    <td className="excel-align-center">{b.arrivalDate}</td>

                    <td className="ms-actions-cell">
                      <RowActionsMenu
                        id={`ms-count-${idx}`}
                        openId={openMenuId}
                        setOpenId={setOpenMenuId}
                        actions={[
                          {
                            label: "View",
                            onClick: () => setViewBatch(b),
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

            <div className="excel-table-wrap">
              <table className="ms-table small excel-table">
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
                  {viewBatch.items.map((p) => (
                    <tr key={p.Stock_id}>
                      <td>{p.Item_id}</td>
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
            </div>

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
