import React, { useEffect, useMemo, useState } from "react";
import { Download, Printer, SlidersHorizontal } from "lucide-react";
import { saveAs } from "file-saver";
import "../styles/reports.css";
import { categoryColor, metricColor, neutralRing, normalizeCategory } from "../styles/colorTokens";

const API_BASE = "http://127.0.0.1:8000";


const StatusPill = ({ status }) => {
  const safeStatus = status ?? "";
  const normalized = safeStatus
    ? safeStatus.toString().toLowerCase().replace(/[^a-z0-9]+/g, "-")
    : "na";

  return (
    <span className={`status-pill status-${normalized}`}>
      {safeStatus || "-"}
    </span>
  );
};

const tableStyles = `
  body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 18px; }
  h2 { margin: 0 0 12px; font-size: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #dfe3ec; padding: 8px 10px; text-align: left; }
  th { background: #eef3ff; }
  tr:nth-child(even) td { background: #f8faff; }
`;

const exportTableToCsv = (rows, columns, filename) => {
  const header = columns.map((col) => `"${col.label}"`).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((col) => {
          const value =
            typeof col.getValue === "function" ? col.getValue(row) : row[col.key];
          const safeValue =
            value === null || value === undefined ? "" : String(value);
          return `"${safeValue.replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob([`${header}\n${body}`], {
    type: "text/csv;charset=utf-8;",
  });
  saveAs(blob, `${filename}.csv`);
};

const printTable = (title, columns, rows) => {
  const tableHead = columns.map((col) => `<th>${col.label}</th>`).join("");
  const tableBody = rows
    .map((row) => {
      const cells = columns
        .map((col) => {
          const value =
            typeof col.getValue === "function" ? col.getValue(row) : row[col.key];
          return `<td>${value ?? ""}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>${tableStyles}</style>
      </head>
      <body>
        <h2>${title}</h2>
        <table>
          <thead><tr>${tableHead}</tr></thead>
          <tbody>${tableBody}</tbody>
        </table>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

const ReportCard = ({
  title,
  description,
  columns,
  rows,
  filename,
  stockView,
  onStockViewChange,
  categoryFilterEnabled = false,
  quantityKey = "available",
  reorderKey = "reorderLevel",
  disableStockFilter = false,
  searchTerm,
  onSearchChange,
  dateFrom,
  dateTo,
  dateKeys = [],
  onDateChange,
}) => {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const stockFilteredRows = useMemo(() => {
    let filtered = rows;

    if (categoryFilterEnabled && stockView !== "all") {
      const norm = (val) => (val || "").toString().toLowerCase();
      const target = norm(stockView);
      filtered = filtered.filter((row) => norm(row.category).includes(target));
    }

    return filtered;
  }, [rows, stockView, categoryFilterEnabled]);

  const dateFilteredRows = useMemo(() => {
    if (!dateKeys.length || (!dateFrom && !dateTo)) return stockFilteredRows;
    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
    return stockFilteredRows.filter((row) => {
      return dateKeys.some((key) => {
        const raw = row[key];
        if (!raw) return false;
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return false;
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
        return true;
      });
    });
  }, [dateFrom, dateTo, dateKeys, stockFilteredRows]);

  const filteredRows = useMemo(() => {
    if (!searchTerm?.trim()) return dateFilteredRows;
    const term = searchTerm.trim().toLowerCase();
    return dateFilteredRows.filter((row) =>
      columns.some((col) => {
        const rawValue =
          typeof col.getValue === "function" ? col.getValue(row) : row[col.key];
        if (Array.isArray(rawValue)) {
          return rawValue.some((val) =>
            String(val ?? "").toLowerCase().includes(term)
          );
        }
        return String(rawValue ?? "").toLowerCase().includes(term);
      })
    );
  }, [columns, searchTerm, dateFilteredRows]);

  useEffect(() => {
    setPage(1);
  }, [filteredRows.length, searchTerm, stockView, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  return (
    <section className="report-card card">
      <header className="report-card__header">
        <div>
          <h2>{title}</h2>
          <p className="report-card__hint">{description}</p>
        </div>
        <div className="report-card__actions">
          {categoryFilterEnabled && onStockViewChange && (
            <div className="report-card__filter">
              <select
                id="report-category-filter"
                value={stockView}
                onChange={(e) => {
                  onStockViewChange(e.target.value);
                }}
              >
                <option value="all">Show all</option>
                <option value="monuments">Monuments</option>
                <option value="granite">Granite</option>
                <option value="quartz">Quartz</option>
              </select>
            </div>
          )}
          <div className="report-search">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search this report"
              aria-label="Search this report"
            />
            {searchTerm ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onSearchChange?.("")}
              >
                Clear
              </button>
            ) : null}
          </div>
          {dateKeys.length > 0 && (
            <div className="date-row">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateChange?.(e.target.value, dateTo)}
                aria-label="From date"
              />
              <span>to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => onDateChange?.(dateFrom, e.target.value)}
                aria-label="To date"
              />
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => onDateChange?.("", "")}
                >
                  Clear
                </button>
              )}
            </div>
          )}
          <button
            className="btn btn-ghost"
            onClick={() => exportTableToCsv(filteredRows, columns, filename)}
          >
            <Download size={16} /> Export Excel (CSV)
          </button>
          <button
            className="btn"
            onClick={() => printTable(`${title} - ${filename}`, columns, filteredRows)}
          >
            <Printer size={16} /> Print / Save PDF
          </button>
        </div>
      </header>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row, idx) => (
              <tr key={`${filename}-${(safePage - 1) * pageSize + idx}`}>
                {columns.map((col) => {
                  const value =
                    typeof col.render === "function" ? col.render(row) : row[col.key];
                  return <td key={col.key}>{value ?? "-"}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="report-pagination">
          <div className="report-page-info">
            Page {safePage} of {totalPages}
          </div>
          <div className="report-page-buttons">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                type="button"
                className={num === safePage ? "active" : ""}
                onClick={() => setPage(num)}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default function Reports() {
  const [stockView, setStockView] = useState("all");
  const [activeReport, setActiveReport] = useState("stock-summary");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    setSearchTerm("");
  }, [activeReport]);




  const [stockSummary, setStockSummary] = useState([]);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [batchWiseStock, setBatchWiseStock] = useState([]);
  const [itemWiseStock, setItemWiseStock] = useState([]);
  const [salesReport, setSalesReport] = useState([]);
  const [returnsReport, setReturnsReport] = useState([]);
  const [movementHistory, setMovementHistory] = useState([]);
  const [paymentReport, setPaymentReport] = useState([]);
  const [batchDetail, setBatchDetail] = useState(null);

  const filteredStockSummary = useMemo(() => {
    if (stockView === "all") return stockSummary;
    const norm = stockView.toLowerCase();
    return stockSummary.filter(
      (row) => (row.category || "").toLowerCase().includes(norm)
    );
  }, [stockSummary, stockView]);

  const filteredLowStock = useMemo(() => {
    if (stockView === "all") return lowStockAlerts;
    const norm = stockView.toLowerCase();
    return lowStockAlerts.filter(
      (row) => (row.category || "").toLowerCase().includes(norm)
    );
  }, [lowStockAlerts, stockView]);

  const quickCounts = useMemo(() => {
    const unitsAvailable = filteredStockSummary.reduce(
      (acc, row) => acc + (row.totalAvailable ?? row.available ?? 0),
      0
    );
    const lowStockCount = filteredLowStock.length;
    const soldUnits = filteredStockSummary.reduce(
      (acc, row) => acc + (row.totalSold ?? 0),
      0
    );

    return { unitsAvailable, lowStockCount, soldUnits };
  }, [filteredStockSummary, filteredLowStock]);

  const colorCategory = stockView === "all" ? "all" : stockView;
  const getStatColor = (metric) => metricColor(metric, colorCategory);

  const buildSlices = (metric) => {
    if (stockView !== "all") return null;

    if (metric === "low") {
      const lowByCat = {};
      lowStockAlerts.forEach((row) => {
        const key = normalizeCategory(row.category);
        lowByCat[key] = (lowByCat[key] || 0) + 1;
      });
      return Object.entries(lowByCat).map(([cat, value]) => ({
        value,
        color: categoryColor(cat, "base"),
      }));
    }

    const keyMap = {
      available: "totalAvailable",
      sold: "totalSold",
    };
    const field = keyMap[metric];
    if (!field) return null;

    const byCat = {};
    filteredStockSummary.forEach((row) => {
      const cat = normalizeCategory(row.category);
      const val = row[field] ?? 0;
      byCat[cat] = (byCat[cat] || 0) + val;
    });

    return Object.entries(byCat).map(([cat, value]) => ({
      value,
      color: categoryColor(cat, "base"),
    }));
  };

  const buildGradient = (slices) => {
    if (!slices || slices.length === 0) return neutralRing;
    const total = slices.reduce((acc, s) => acc + (s.value || 0), 0);
    if (!total) return neutralRing;
    let current = 0;
    return `conic-gradient(${slices
      .map((slice) => {
        const start = (current / total) * 100;
        current += slice.value || 0;
        const end = (current / total) * 100;
        return `${slice.color} ${start}% ${end}%`;
      })
      .join(", ")})`;
  };






useEffect(() => {
  async function loadReport() {

    // STOCK SUMMARY
    if (activeReport === "stock-summary") {
      const res = await fetch(`${API_BASE}/reports/stock-summary`);
      const data = await res.json();
      setStockSummary(data);
    }

    // LOW STOCK ALERTS
    if (activeReport === "low-stock") {
      const res = await fetch(`${API_BASE}/reports/low-stock`);
      const data = await res.json();
      setLowStockAlerts(data);
    }
    if (activeReport === "batch-wise") {
      const res = await fetch(`${API_BASE}/reports/batch-wise`);
      const data = await res.json();
      setBatchWiseStock(data);

      // Preload item-wise data to power batch detail modal
      const itemRes = await fetch(`${API_BASE}/reports/item-wise`);
      const itemData = await itemRes.json();
      setItemWiseStock(itemData);
    }
    if (activeReport === "item-wise") {
      const res = await fetch(`${API_BASE}/reports/item-wise`);
      const data = await res.json();
      setItemWiseStock(data);
    }
    if (activeReport === "sales") {
  const res = await fetch(`${API_BASE}/reports/sales`);
  const data = await res.json();
  setSalesReport(data);
}
if (activeReport === "returns") {
  const res = await fetch(`${API_BASE}/reports/returns`);
  const data = await res.json();
  setReturnsReport(data);
}
if (activeReport === "movement") {
  const res = await fetch(`${API_BASE}/reports/movement`);
  const data = await res.json();
  setMovementHistory(data);
}
if (activeReport === "payments") {
  const res = await fetch(`${API_BASE}/reports/payments`);
  const data = await res.json();
  console.log("Payments data:", data);
  setPaymentReport(data);
}






  }

  loadReport();
  }, [activeReport]);

  const openBatchDetails = (batchCode) => {
    if (!batchCode) return;
    const summary = batchWiseStock.find((b) => b.batchCode === batchCode) || null;
    const items = itemWiseStock.filter((i) => i.batchCode === batchCode);
    setBatchDetail({
      batchCode,
      summary,
      items,
    });
  };


  const stockSummaryColumns = [
    { key: "category", label: "Category" },
    { key: "totalQuantity", label: "Total Quantity" },
    { key: "totalOut", label: "Total Out" },
    { key: "totalSold", label: "Total Sold" },
    { key: "totalReturned", label: "Total Returned" },
    { key: "totalAvailable", label: "Total Available" },
  ];

  const batchWiseColumns = [
  { key: "batchCode", label: "Batch Code", render: (row) => (
    <button className="link-btn" onClick={() => openBatchDetails(row.batchCode)}>
      {row.batchCode}
    </button>
  ) },
  { key: "category", label: "Category" },
  { key: "itemCount", label: "Item Count" },
  { key: "batchQuantity", label: "Batch Quantity" },
  { key: "sold", label: "Sold" },
  { key: "out", label: "Out" },
  { key: "returned", label: "Returned" },
  { key: "available", label: "Available" },
];


  const itemWiseColumns = [
    {
      key: "batchCode",
      label: "Batch Code",
      render: (row) => (
        <button className="link-btn" onClick={() => openBatchDetails(row.batchCode)}>
          {row.batchCode}
        </button>
      ),
    },
    { key: "itemId", label: "Item ID" },
    { key: "category", label: "Category" },
    { key: "productName", label: "Product Name" },
    { key: "size", label: "Size" },
    { key: "colour", label: "Colour", render: (row) => row.colour || row.color || "-" },
    { key: "status", label: "Status", render: (row) => <StatusPill status={row.status} /> },
    { key: "clientName", label: "Client Name" },
    { key: "deliveryOrderNo", label: "Delivery Order No" },
    { key: "createdDate", label: "Created Date" },
  ];

  const salesColumns = [
    { key: "batchCode", label: "Batch Code" },
    { key: "itemId", label: "Item ID" },
    { key: "category", label: "Category" },
    { key: "productName", label: "Product Name" },
    { key: "size", label: "Size" },
    { key: "colour", label: "Colour", render: (row) => row.colour || row.color || "-" },
    { key: "clientName", label: "Client Name" },
    { key: "deliveryOrderNo", label: "Delivery Order No" },
    { key: "saleDate", label: "Sale Date" },
    { key: "deliveryMode", label: "Delivery Mode" },
  ];

  const returnsColumns = [
    { key: "batchCode", label: "Batch Code" },
    {
      key: "itemIds",
      label: "Item IDs",
      render: (row) => row.itemIds.join(", "),
      getValue: (row) => row.itemIds.join(" | "),
    },
    { key: "category", label: "Category" },
    { key: "productName", label: "Product Name" },
    { key: "size", label: "Size" },
    { key: "colour", label: "Colour", render: (row) => row.colour || row.color || "-" },
    { key: "clientName", label: "Client Name" },
    { key: "deliveryOrderNo", label: "Delivery Order No" },
    { key: "returnDate", label: "Return Date" },
    { key: "reason", label: "Reason" },
    {
      key: "bulk",
      label: "Bulk?",
      render: (row) => (row.bulk ? "Yes" : "No"),
      getValue: (row) => (row.bulk ? "Yes" : "No"),
    },
  ];

  const movementColumns = [
    { key: "itemId", label: "Item ID" },
    { key: "productName", label: "Product Name" },
    { key: "movementType", label: "Movement Type", render: (row) => <StatusPill status={row.movementType} /> },
    { key: "scanDate", label: "Scan Date" },
    { key: "clientName", label: "Client Name" },
    { key: "deliveryOrderNo", label: "Delivery Order No" },
    { key: "deliveryMode", label: "Delivery Mode" },
    { key: "userName", label: "User (Name)" },
    { key: "undoReason", label: "Undo Reason" },
  ];

  const lowStockColumns = [
    { key: "batchCode", label: "Batch Code" },
    { key: "itemName", label: "Item Name" },
    { key: "category", label: "Category" },
    { key: "availableQuantity", label: "Available Quantity" },
    { key: "threshold", label: "Threshold" },
    { key: "status", label: "Status (LOW STOCK)", render: (row) => <StatusPill status={row.status} /> },
  ];

  const paymentColumns = [
    { key: "poInvoiceNumber", label: "PO Invoice Number" },
    { key: "vendorName", label: "Vendor Name" },
    { key: "paymentDate", label: "Payment Date" },
    {
      key: "amount",
      label: "Amount",
      render: (row) => `Rs ${row.amount.toLocaleString("en-IN")}`,
      getValue: (row) => row.amount,
    },
    { key: "paymentStatus", label: "Payment Status", render: (row) => <StatusPill status={row.paymentStatus} /> },
    { key: "notes", label: "Notes" },
    { key: "createdAt", label: "Created At" },
  ];

    const reportsConfig = [
    {
      key: "stock-summary",
      label: "Stock Summary",
      title: "STOCK SUMMARY REPORT (Category-wise)",
      description: "Inventory position by category with movement and current availability.",
      columns: stockSummaryColumns,
      rows: stockSummary,
      filename: "stock-summary-report",
      stockFilter: true,
      categoryFilter: true,
      quantityKey: "totalAvailable",
      reorderKey: "threshold",
      dateKeys: [],
    },
    {
      key: "batch-wise",
      label: "Batch Wise Stock",
      title: "BATCH-WISE STOCK REPORT",
      description: "Movement summary and availability for every batch.",
      columns: batchWiseColumns,
      rows: batchWiseStock,
      filename: "batch-wise-stock-report",
      stockFilter: true,
      categoryFilter: true,
      quantityKey: "available",
      reorderKey: "threshold",
      dateKeys: [],
    },
    {
      key: "item-wise",
      label: "Item Wise Stock",
      title: "ITEM-WISE STOCK REPORT",
      description: "Individual item-level stock with status, batch, and client details.",
      columns: itemWiseColumns,
      rows: itemWiseStock,
      filename: "item-wise-stock-report",
      stockFilter: false,
      categoryFilter: true,
      dateKeys: ["createdDate"],
    },
    {
      key: "sales",
      label: "Sales",
      title: "SALES REPORT",
      description: "Delivery order level sales with item and dispatch details.",
      columns: salesColumns,
      rows: salesReport,
      filename: "sales-report",
      stockFilter: false,
      categoryFilter: true,
      disableStockFilter: true,
      dateKeys: ["saleDate"],
    },
    {
      key: "returns",
      label: "Returns",
      title: "RETURNS REPORT",
      description: "Returns with item groups, reasons, and bulk indicators.",
      columns: returnsColumns,
      rows: returnsReport,
      filename: "returns-report",
      stockFilter: false,
      disableStockFilter: true,
      dateKeys: ["returnDate"],
    },
    {
      key: "movement",
      label: "Movement",
      title: "MOVEMENT HISTORY REPORT",
      description: "Scan trail with movement type, user, and undo notes.",
      columns: movementColumns,
      rows: movementHistory,
      filename: "movement-history",
      stockFilter: false,
      disableStockFilter: true,
      dateKeys: ["scanDate"],
    },
    {
      key: "low-stock",
      label: "Low Stock Alerts",
      title: "LOW STOCK ALERT REPORT",
      description: "Batches below threshold.",
      columns: lowStockColumns,
      rows: lowStockAlerts,
      filename: "low-stock-alert-report",
      stockFilter: true,
      forceStockView: "low",
      categoryFilter: true,
      quantityKey: "availableQuantity",
      reorderKey: "threshold",
      dateKeys: [],
    },
    {
      key: "payments",
      label: "Payments",
      title: "PAYMENT REPORT",
      description: "Supplier invoices with payment status and notes.",
      columns: paymentColumns,
      rows: paymentReport,
      filename: "payment-report",
      stockFilter: false,
      disableStockFilter: true,
      dateKeys: ["paymentDate", "createdAt"],
    },
  ];

  const selectedReport =
    reportsConfig.find((report) => report.key === activeReport) ||
    reportsConfig[0];

  const effectiveStockView =
    selectedReport.stockFilter || selectedReport.categoryFilter
      ? selectedReport.forceStockView || stockView
      : "all";

  const allowCategorySelect =
    selectedReport.categoryFilter ||
    (selectedReport.stockFilter && !selectedReport.disableStockFilter);

  return (
    <div className="reports-page container">
      <header className="reports-hero card">
        <div>
          <p className="eyebrow">Reports</p>
          <h1>Inventory and Sales Reports</h1>
          <p className="reports-hero__subtitle">
            Download any report as Excel or print/save as PDF. Use the stock filter or search box to focus quickly.
          </p>
        </div>
        <div className="reports-filters">
          <label className="filter-label">
            <SlidersHorizontal size={16} />
            Stock focus
          </label>
          <select
            value={stockView}
            onChange={(e) => setStockView(e.target.value)}
            className="stock-filter-select"
          >
            <option value="all">Show all</option>
            <option value="monuments">Monuments</option>
            <option value="granite">Granite</option>
            <option value="quartz">Quartz</option>
          </select>
          <p className="filter-hint">Filter reports by category.</p>
        </div>
      </header>

      <div className="reports-grid">
        <div className="report-stats card">
          <p className="eyebrow">Quick stats</p>
          <div className="report-stats__row">
            {(() => {
              const stats = [
                { key: "available", label: "Units available", value: quickCounts.unitsAvailable, color: getStatColor("available") },
                { key: "low", label: "Low stock items", value: quickCounts.lowStockCount, color: getStatColor("low") },
                { key: "sold", label: "Units sold (all time)", value: quickCounts.soldUnits, color: getStatColor("sold") },
              ];
              const total = Math.max(
                stats.reduce((acc, s) => acc + (s.value || 0), 0),
                1
              );
              return stats.map((stat) => {
                const percent = Math.min(100, Math.round(((stat.value || 0) / total) * 100));
                const angle = (stat.value || 0) === 0 ? 0 : (stat.value / total) * 360;
                const slices = buildSlices(stat.key);
                const bg =
                  slices && slices.length
                    ? buildGradient(slices)
                    : angle === 0
                      ? neutralRing
                      : `conic-gradient(${stat.color} 0deg ${angle}deg, ${neutralRing} ${angle}deg 360deg)`;
                return (
                  <div key={stat.key} className="stat-pie-card">
                    <div className="stat-pie" style={{ background: bg }}>
                      <div className="stat-pie__center">
                        <div className="stat-pie__value">{Number(stat.value || 0).toLocaleString("en-IN")}</div>
                        <div className="stat-pie__percent">{percent}%</div>
                      </div>
                    </div>
                    <div className="stat-pie__value-text">
                      {Number(stat.value || 0).toLocaleString("en-IN")}
                    </div>
                    <span className="report-stats__label">{stat.label}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      <div className="report-tabs card">
        {reportsConfig.map((report) => (
          <button
            key={report.key}
            className={
              "report-tab" + (report.key === activeReport ? " report-tab-active" : "")
            }
            onClick={() => setActiveReport(report.key)}
          >
            {report.label}
          </button>
        ))}
      </div>

      <ReportCard
        title={selectedReport.title}
        description={selectedReport.description}
        columns={selectedReport.columns}
        rows={selectedReport.rows}
        filename={selectedReport.filename}
        stockView={effectiveStockView}
        onStockViewChange={allowCategorySelect ? setStockView : undefined}
        categoryFilterEnabled={selectedReport.categoryFilter}
        quantityKey={selectedReport.quantityKey}
        reorderKey={selectedReport.reorderKey}
        disableStockFilter={selectedReport.disableStockFilter}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        dateFrom={dateFrom}
        dateTo={dateTo}
        dateKeys={selectedReport.dateKeys || []}
        onDateChange={(from, to) => {
          setDateFrom(from);
          setDateTo(to);
        }}
      />

      {batchDetail && (
        <div className="modal-overlay" onClick={() => setBatchDetail(null)}>
          <div className="modal-box modal-box-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-box__header">
              <h2 className="modal-title">Batch Details - {batchDetail.batchCode}</h2>
              <button className="modal-close-icon" onClick={() => setBatchDetail(null)} aria-label="Close">
                x
              </button>
            </div>
            {(() => {
              const first = batchDetail.items[0] || {};
              const product = first.productName || batchDetail.summary?.itemName || "-";
              const size = first.size || batchDetail.summary?.size || "-";
              return (
                <div className="modal-meta">
                  <p><strong>Product Name:</strong> {product}</p>
                  <p><strong>Size:</strong> {size}</p>
                </div>
              );
            })()}

            <div className="table-wrap modal-table-scroll" style={{ marginTop: "10px" }}>
              <table className="table">
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
                  {batchDetail.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", color: "#6b7280" }}>
                        No items found for this batch.
                      </td>
                    </tr>
                  ) : (
                    batchDetail.items.map((item) => (
                      <tr key={item.itemId || item.Item_id || `${item.batchCode}-${item.productName}`}>
                        <td>{item.batchCode || item.Batch_code || batchDetail.batchCode}</td>
                        <td>{item.itemId || item.Item_id || "-"}</td>
                        <td>{item.category || item.Category || batchDetail.summary?.category || "-"}</td>
                        <td>{item.productName || item.Product_name || "-"}</td>
                        <td>{item.size || item.Size || "-"}</td>
                        <td>{item.colour || item.Colour || item.Color || "-"}</td>
                        <td><StatusPill status={item.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <button className="modal-close" onClick={() => setBatchDetail(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

