
import React, { useEffect, useState } from "react";
import "../styles/returns.css";
// import { supabase } from "../supabaseClient"; // REMOVED

const API_BASE = "http://127.0.0.1:8000";

export default function ReturnsPage() {
  const [selectedCategory, setSelectedCategory] = useState("Monuments");
  const [returnsList, setReturnsList] = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchDraft, setSearchDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [viewPopup, setViewPopup] = useState(null);

  /* -----------------------------------------------------
        DEDUCE CATEGORY FROM BATCH CODE
        MN -> Monuments
        GM -> Granite
        QZ -> Quartz
  ------------------------------------------------------ */
  function detectCategory(row) {
    const base = (row.batch_code || row.product_name || "").toUpperCase();

    if (base.startsWith("MN")) return "Monuments";
    if (base.startsWith("GM")) return "Granite";
    if (base.startsWith("QZ")) return "Quartz";

    return "Others";
  }

  /* -----------------------------------------------------
        FETCH RETURNS
  ------------------------------------------------------ */
  async function fetchReturns() {
    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/returns/`);
      if (!res.ok) throw new Error("Failed to load returns");

      const data = await res.json();
      setReturnsList(data);
    } catch (err) {
      console.error("Returns fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReturns();

    const handler = () => fetchReturns();
    window.addEventListener("stock-updated", handler);

    return () => window.removeEventListener("stock-updated", handler);
  }, []);

  /* -----------------------------------------------------
        FILTERS
  ------------------------------------------------------ */
  const filtered = (returnsList || []).filter((row) => {
    // Category check (deduced, not stored)
    if (detectCategory(row) !== selectedCategory) return false;

    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;

    const itemIds = row.item_ids || [];
    const itemIdsStr = Array.isArray(itemIds) ? itemIds.join(" ") : String(itemIds);

    const haystack = [
      row.product_name,
      row.batch_code,
      row.client_name,
      row.do_number,
      row.return_date,
      row.reason,
      row.size,
      itemIdsStr
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(term);
  });

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchTerm(searchDraft.trim());
  };

  const clearSearch = () => {
    setSearchDraft("");
    setSearchTerm("");
  };

  /* -----------------------------------------------------
        UI START
  ------------------------------------------------------ */
  return (
    <div className="returns-page">

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
      <form className="filters-row" onSubmit={handleSearch}>
        <input
          className="filter-input returns-search-input"
          type="search"
          placeholder="Search returns (item, product, batch, client, DO, date, reason...)"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
        />
        <button className="view-btn" type="submit">
          Search
        </button>
        <button className="view-btn clear-btn" type="button" onClick={clearSearch}>
          Clear
        </button>
      </form>

      {/* MAIN TABLE CARD */}
      <div className="returns-card">
        <h3 className="table-title">Returned Items - {selectedCategory}</h3>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="returns-table">
            <thead>
              <tr>
                <th>Batch Code</th>
                <th>Item IDs</th>
                <th>Category</th>
                <th>Product Name</th>
                <th>Size</th>
                <th>Colour</th>
                <th>Client</th>
                <th>DO</th>
                <th>Return Date</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="11" className="no-data">
                    No returned items found.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.return_id}>
                    <td>{row.batch_code}</td>
                    <td>
                      {row.is_bulk && Array.isArray(row.item_ids)
                        ? `${row.item_ids[0]} - ${row.item_ids[row.item_ids.length - 1]}`
                        : (Array.isArray(row.item_ids) ? row.item_ids.join(", ") : row.item_ids)}
                    </td>
                    <td>{detectCategory(row)}</td>
                    <td>{row.product_name}</td>
                    <td>{row.size || "-"}</td>
                    <td>{row.colour ?? "-"}</td>
                    <td>{row.client_name}</td>
                    <td>{row.do_number}</td>
                    <td>{row.return_date}</td>
                    <td>{row.reason}</td>

                    <td>
                      <button
                        className="view-btn"
                        onClick={() =>
                          setViewPopup({
                            ...row,
                            colour: row.colour ?? "-",
                          })
                        }

                      >
                        View
                      </button>
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
            <div className="popup-header">
              <h3>Return Details</h3>
              <button className="close-btn" onClick={() => setViewPopup(null)}>
                x
              </button>
            </div>

            <div className="popup-meta">
              <p><strong>Batch Code:</strong> {viewPopup.batch_code}</p>
              <p><strong>Client:</strong> {viewPopup.client_name}</p>
              <p><strong>Category:</strong> {detectCategory(viewPopup)}</p>
              <p><strong>Return Date:</strong> {viewPopup.return_date}</p>
              <p><strong>Reason:</strong> {viewPopup.reason}</p>
            </div>

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
                </tr>
              </thead>

              <tbody>
                {Array.isArray(viewPopup.item_ids) && viewPopup.item_ids.map((id, i) => (
                  <tr key={i}>
                    <td>{viewPopup.batch_code}</td>
                    <td>{id}</td>
                    <td>{detectCategory(viewPopup)}</td>
                    <td>{viewPopup.product_name}</td>
                    <td>{viewPopup.size}</td>
                    <td>{viewPopup.colour ?? "-"}</td>

                    <td>Returned</td>
                  </tr>
                ))}
              </tbody>
            </table>

          </div>
        </div>
      )}

    </div>
  );
}
