
import React, { useEffect, useState } from "react";
import "../styles/returns.css";
import CategoryPills from "../components/CategoryPills";
import RowActionsMenu from "../components/RowActionsMenu";
// import { supabase } from "../supabaseClient"; // REMOVED

const API_BASE = "http://127.0.0.1:8000";

export default function ReturnsPage() {
  const [selectedCategory, setSelectedCategory] = useState("Monuments");
  const [returnsList, setReturnsList] = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchDraft, setSearchDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const [viewPopup, setViewPopup] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  /* -----------------------------------------------------
        DEDUCE CATEGORY FROM BATCH CODE
        MN -> Monuments
        GM -> Granite
        QZ -> Quartz
  ------------------------------------------------------ */
  function detectCategory(row) {
    // 1. Check joined data from Database (Products table stores Category)
    if (row.Products && row.Products.Category) {
      return row.Products.Category;
    }

    // 2. Fallback: Check item ID prefix (Requested by user)
    const itemIds = Array.isArray(row.item_ids) ? row.item_ids : [row.item_ids];
    const firstId = (itemIds[0] || "").toUpperCase();
    if (firstId.startsWith("QZ")) return "Quartz";
    if (firstId.startsWith("MN")) return "Monuments";
    if (firstId.startsWith("GM")) return "Granite";

    // 3. Fallback: Check Batch Code / Product Name
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
    // 1. Category check
    if (detectCategory(row) !== selectedCategory) return false;

    // 2. Date filter
    if (dateFilter && row.return_date !== dateFilter) return false;

    // 3. Universal Search
    if (searchDraft.trim()) {
      const parts = searchDraft.toLowerCase().split(/[ ,+]+/).filter(Boolean);
      const itemIdsStr = Array.isArray(row.item_ids) ? row.item_ids.join(" ") : String(row.item_ids);

      const searchableText = [
        row.product_name,
        row.batch_code,
        row.client_name,
        row.do_number,
        row.return_date,
        row.reason,
        row.size,
        row.colour,
        itemIdsStr
      ].join(" ").toLowerCase();

      return parts.every(p => searchableText.includes(p));
    }

    return true;
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
      <CategoryPills value={selectedCategory} onChange={setSelectedCategory} className="category-tabs" />

      {/* SEARCH & FILTERS */}
      <div className="list-header-row-standard">
        <h3 className="table-title">Returned Items - {selectedCategory}</h3>

        <div className="list-filters-standard">
          <div className="search-box-wrapper-standard">
            <input
              type="text"
              className="search-input-standard"
              placeholder="Search returns (item, product, batch, client, DO, date, reason...)"
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

      {/* MAIN TABLE CARD */}
      <div className="returns-card">

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="excel-table-wrap">
            <table className="returns-table excel-table">
              <colgroup>
                <col className="excel-col-md" />
                <col className="excel-col-lg" />
                <col className="excel-col-sm" />
                <col className="excel-col-lg" />
                <col className="excel-col-sm" />
                <col className="excel-col-sm" />
                <col className="excel-col-md" />
                <col className="excel-col-sm" />
                <col className="excel-col-md excel-align-center" />
                <col className="excel-col-wide" />
                <col className="excel-col-actions" />
              </colgroup>
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
                  <th className="excel-align-center">Return Date</th>
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
                      <td className="excel-align-center">{row.return_date}</td>
                      <td>{row.reason}</td>

                      <td className="returns-actions-cell">
                        <RowActionsMenu
                          id={`returns-${row.return_id}`}
                          openId={openMenuId}
                          setOpenId={setOpenMenuId}
                          actions={[
                            {
                              label: "View",
                              onClick: () =>
                                setViewPopup({
                                  ...row,
                                  colour: row.colour ?? "-",
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

            <div className="excel-table-wrap">
              <table className="items-table excel-table">
                <colgroup>
                  <col className="excel-col-md" />
                  <col className="excel-col-md" />
                  <col className="excel-col-sm" />
                  <col className="excel-col-lg" />
                  <col className="excel-col-sm" />
                  <col className="excel-col-sm" />
                  <col className="excel-col-sm" />
                </colgroup>
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
        </div>
      )}

    </div>
  );
}
