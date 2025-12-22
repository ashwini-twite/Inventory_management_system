
import React, { useEffect, useState } from "react";
import "../styles/deliveryList.css";
// import { supabase } from "../supabaseClient"; // REMOVED
// import { returnBefore, returnAfter, undoSale } from "../services/stockActions"; // REMOVED

const API_BASE = "http://127.0.0.1:8000";

export default function Deliverylist() {
  const [selectedCategory, setSelectedCategory] = useState("Monuments");
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchDraft, setSearchDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [viewPopup, setViewPopup] = useState(null);
  const [undoPopup, setUndoPopup] = useState(null);
  const [undoReason, setUndoReason] = useState("");

  /* ---------------------------------------------------------
      FETCH DELIVERY LIST - Items currently OUT or SOLD
  --------------------------------------------------------- */
  async function fetchDeliveries() {
    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/scan/deliveries`);
      if (!res.ok) throw new Error("Failed to load deliveries");

      const allData = await res.json();

      // Category filter ONLY (Backend returns all OUT/SOLD, we filter locally for simplicity and speed)
      // Could also filter on backend, but this reuse is fine for now
      const filtered = allData.filter((group) => {
        // We need to check if ANY item in group matches category? 
        // Or if the group is primarily one category?
        // The original code filtered RAW ROWS first.

        // Let's filter the items within groups, and if group empty, remove it.
        // But the previous code: "filter(row => row.Category == selectedCategory)".
        // So we should filter items first.
        return true;
      });

      // We re-process to filter items by category on client side for the tabs
      const finalGroups = [];

      allData.forEach(g => {
        const catItems = g.items.filter(it => (it.category || "").toLowerCase() === selectedCategory.toLowerCase());

        if (catItems.length > 0) {
          // Include this group, but maybe only show relevant items?
          // Original code: grouped by DO after filtering rows.
          // So if a DO has Monuments and Granite, it appears in both tabs but only shows relevant items.
          finalGroups.push({
            ...g,
            items: catItems
          });
        }
      });

      // Search filter
      let visible = finalGroups;
      if (searchTerm.trim()) {
        const lower = searchTerm.toLowerCase();
        visible = visible.filter((g) =>
          g.do?.toLowerCase().includes(lower) ||
          g.client?.toLowerCase().includes(lower) ||
          g.items.some((it) =>
            `${it.itemId} ${it.product} ${it.batch} ${it.status} ${it.colour}${it.size}`
              .toLowerCase()
              .includes(lower)
          )
        );
      }

      setDeliveries(visible);
    } catch (err) {
      console.error("Delivery fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchTerm(searchDraft.trim());
  };

  const clearSearch = () => {
    setSearchDraft("");
    setSearchTerm("");
  };

  useEffect(() => {
    fetchDeliveries();

    const handler = () => fetchDeliveries();
    window.addEventListener("stock-updated", handler);

    return () => window.removeEventListener("stock-updated", handler);
  }, [selectedCategory, searchTerm]);

  /* ---------------------------------------------------------
      RETURN ITEM
  --------------------------------------------------------- */
  async function handleReturn(stockId, status) {
    const reason = window.prompt("Reason for return?");

    if (!reason) return;

    // Use SCAN router return endpoint which handles both before/after logic
    try {
      const type = status === "Out" ? "before" : "after";
      const res = await fetch(`${API_BASE}/scan/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stock_id: stockId,
          reason: reason,
          type: type
        })
      });

      if (!res.ok) throw new Error("Return failed");

      fetchDeliveries();
    } catch (err) {
      console.error("Return error:", err);
      alert("Failed to return item");
    }
  }

  /* ---------------------------------------------------------
      UNDO SALE
  --------------------------------------------------------- */
  async function handleUndo() {
    if (!undoPopup) return;

    try {
      const res = await fetch(`${API_BASE}/scan/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stock_id: undoPopup.stockId,
          reason: undoReason || "Undo from Delivery List"
        })
      });

      if (!res.ok) throw new Error("Undo failed");

      setUndoPopup(null);
      setUndoReason("");
      fetchDeliveries();

    } catch (err) {
      console.error("Undo error", err);
      alert("Failed to undo sale");
    }
  }

  return (
    <div className="delivery-list-page">
      {/* CATEGORY TABS */}
      <div className="category-tabs">
        {["Monuments", "Granite", "Quartz"].map((cat) => (
          <button
            key={cat}
            className={`category-tab ${selectedCategory === cat ? "active-category" : ""
              }`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* SEARCH */}
      <form onSubmit={handleSearch} className="delivery-search-row">
        <input
          type="search"
          className="delivery-search-input-modern"
          placeholder="Search deliveries (DO, client, date, items...)"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
        />
        <button className="action-button" type="submit">
          Search
        </button>
        <button
          className="action-button"
          type="button"
          onClick={clearSearch}
          style={{ background: "#f3f4f6", color: "#111" }}
        >
          Clear
        </button>
      </form>

      {/* TABLE */}
      <div className="card-table-container">
        <h3 className="table-title">Delivery List - {selectedCategory}</h3>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="card-table">
            <thead>
              <tr>
                <th>DO Number</th>
                <th>Client</th>
                <th>Date</th>
                <th>Items Count</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center" }}>
                    No deliveries found.
                  </td>
                </tr>
              ) : (
                deliveries.map((row, index) => (
                  <tr key={index}>
                    <td>{row.do}</td>
                    <td>{row.client}</td>
                    <td>{row.date}</td>
                    <td>{row.items.length}</td>

                    <td>
                      <button
                        className="action-button"
                        onClick={() => setViewPopup(row)}
                      >
                        View
                      </button>

                      {row.items.some((x) => x.status === "Sold") && (
                        <button
                          className="action-button"
                          onClick={() =>
                            setUndoPopup({
                              stockId: row.items[0].stockId,
                              client: row.client,
                              do: row.do,
                            })
                          }
                        >
                          Undo
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* VIEW POPUP */}
      {viewPopup && (
        <div className="popup-backdrop">
          <div className="popup-card">
            <h3>Delivery Details</h3>

            <p>
              <strong>DO:</strong> {viewPopup.do}
            </p>
            <p>
              <strong>Client:</strong> {viewPopup.client}
            </p>
            <p>
              <strong>Date:</strong> {viewPopup.date}
            </p>

            <h4>Items</h4>
            <table className="items-table">
              <thead>
                <tr>
                  <th>Batch Code</th>
                  <th>Item ID</th>
                  <th>Category</th>
                  <th>Product Name</th>
                  <th>Size</th>
                  <th>Colour</th>
                  <th>Status</th>
                  <th>Return</th>
                </tr>
              </thead>

              <tbody>
                {viewPopup.items.map((x, i) => (
                  <tr key={i}>
                    <td>{x.batch}</td>
                    <td>{x.itemId}</td>
                    <td>{x.category || "-"}</td>
                    <td>{x.product}</td>
                    <td>{x.size}</td>
                    <td>{x.colour}</td>
                    <td>{x.status}</td>

                    <td>
                      <button
                        className="action-button"
                        onClick={() => handleReturn(x.stockId, x.status)}
                      >
                        Return
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button className="close-btn" onClick={() => setViewPopup(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* UNDO POPUP */}
      {undoPopup && (
        <div className="popup-backdrop">
          <div className="popup-card">
            <h3>Undo Sale - {undoPopup.do}</h3>

            <textarea
              className="undo-textarea"
              rows="3"
              placeholder="Reason"
              value={undoReason}
              onChange={(e) => setUndoReason(e.target.value)}
            />

            <div className="popup-actions">
              <button className="close-btn" onClick={() => setUndoPopup(null)}>
                Cancel
              </button>

              <button className="confirm-btn" onClick={handleUndo}>
                Confirm Undo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
