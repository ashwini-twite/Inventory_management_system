import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Download, Printer, SlidersHorizontal } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip as ReTooltip, Legend as ReLegend, ResponsiveContainer } from "recharts";
import { saveAs } from "file-saver";
import "../styles/reports.css";
import SelectMenu from "../components/SelectMenu";
import { categoryColor, normalizeCategory } from "../styles/colorTokens";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";


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
  body { font-family: "Sora", "Segoe UI", sans-serif; padding: 18px; color: #0f172a; }
  h2 { margin: 0 0 12px; font-size: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; }
  th { background: #f8fafc; }
  tr:nth-child(even) td { background: #fafafa; }
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

const getExcelColumnMeta = (column) => {
  const rawKey = column?.key ?? "";
  const rawLabel = column?.label ?? "";
  const key = `${rawKey} ${rawLabel}`.toLowerCase();

  if (key.includes("date")) {
    return { widthClass: "excel-col-md", alignClass: "excel-align-center" };
  }

  if (
    key.includes("amount") ||
    key.includes("total") ||
    key.includes("qty") ||
    key.includes("quantity") ||
    key.includes("paid") ||
    key.includes("balance") ||
    key.includes("price") ||
    key.includes("threshold") ||
    key.includes("available") ||
    key.includes("sold") ||
    key.includes("returned")
  ) {
    return { widthClass: "excel-col-sm", alignClass: "excel-align-right" };
  }

  if (key.includes("id") || key.includes("code") || key.includes("invoice")) {
    return { widthClass: "excel-col-md", alignClass: "" };
  }

  if (
    key.includes("product") ||
    key.includes("client") ||
    key.includes("vendor") ||
    key.includes("reason") ||
    key.includes("notes") ||
    key.includes("description")
  ) {
    return { widthClass: "excel-col-lg", alignClass: "" };
  }

  return { widthClass: "excel-col-md", alignClass: "" };
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
  const [pageWindowStart, setPageWindowStart] = useState(1);
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
    setPageWindowStart(1);
  }, [filteredRows.length, searchTerm, stockView, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const clampedWindowStart = Math.min(
    Math.max(1, pageWindowStart),
    Math.max(1, totalPages - 2)
  );
  const windowPages = [0, 1, 2]
    .map((offset) => clampedWindowStart + offset)
    .filter((num) => num <= totalPages);
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
              <SelectMenu
                value={stockView}
                onChange={onStockViewChange}
                className="report-filter-select"
                options={[
                  { label: "Show all", value: "all" },
                  { label: "Monuments", value: "monuments" },
                  { label: "Granite", value: "granite" },
                  { label: "Quartz", value: "quartz" },
                ]}
                ariaLabel="Report category"
              />
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

      <div className="table-wrap excel-table-wrap">
        <table className="table excel-table">
          <colgroup>
            {columns.map((col) => {
              const meta = getExcelColumnMeta(col);
              return (
                <col
                  key={`col-${col.key}`}
                  className={`${meta.widthClass} ${meta.alignClass}`.trim()}
                />
              );
            })}
          </colgroup>
          <thead>
            <tr>
              {columns.map((col) => {
                const meta = getExcelColumnMeta(col);
                return (
                  <th key={col.key} className={meta.alignClass}>
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row, idx) => (
              <tr key={`${filename}-${(safePage - 1) * pageSize + idx}`}>
                {columns.map((col) => {
                  const meta = getExcelColumnMeta(col);
                  const value =
                    typeof col.render === "function" ? col.render(row) : row[col.key];
                  return (
                    <td key={col.key} className={meta.alignClass}>
                      {value ?? "-"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="report-card__footer">
        <div className="report-pagination">
          <div className="report-page-info">
            Page {safePage} of {totalPages}
          </div>
          <div className="report-page-buttons">
            <button
              type="button"
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                setPageWindowStart((start) => Math.max(1, start - 3));
              }}
              disabled={safePage === 1}
            >
              Prev
            </button>
            {windowPages.map((num) => (
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
              onClick={() => {
                setPage((p) => Math.min(totalPages, p + 1));
                setPageWindowStart((start) =>
                  Math.min(totalPages - 2, start + 3)
                );
              }}
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
  const location = useLocation();

  useEffect(() => {
    setSearchTerm("");
  }, [activeReport]);

  useEffect(() => {
    const stateCategory = location.state?.category;
    const searchParams = new URLSearchParams(location.search);
    const queryCategory = searchParams.get("category");
    const incoming = stateCategory || queryCategory;
    if (incoming) {
      setStockView(incoming.toLowerCase());
      setActiveReport("stock-summary");
    }
  }, [location.state, location.search]);


  const [stockSummary, setStockSummary] = useState([]);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [batchWiseStock, setBatchWiseStock] = useState([]);
  const [itemWiseStock, setItemWiseStock] = useState([]);
  const [salesReport, setSalesReport] = useState([]);
  const [returnsReport, setReturnsReport] = useState([]);
  const [movementHistory, setMovementHistory] = useState([]);
  const [paymentReport, setPaymentReport] = useState([]);
  const [batchDetail, setBatchDetail] = useState(null);

  const categorySwatch = (key, tone = "base") => categoryColor(key, tone);
  const mutedColor = "#E5E7EB";
  const normalizedFilter =
    stockView === "all" ? "all" : normalizeCategory(stockView);
  const showAll = normalizedFilter === "all";
  const fetchStockSummaryData = async () => {
    try {
      const res = await fetch(`${API_BASE}/reports/stock-summary`);
      if (!res.ok) throw new Error("Failed to load stock summary");
      const data = await res.json();
      setStockSummary(data);
    } catch (err) {
      console.error("Stock summary error:", err);
    }
  };

  useEffect(() => {
    // Stock summary for category & sold charts
    fetchStockSummaryData();

    // ✅ Low stock MUST be loaded globally for Quick Stats
    fetch(`${API_BASE}/reports/low-stock`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load low stock");
        return res.json();
      })
      .then((data) => setLowStockAlerts(data))
      .catch((err) => console.error("Low stock error:", err));
  }, []);


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

  const categoryTotals = useMemo(() => {
    const totals = { granite: 0, quartz: 0, monuments: 0 };

    const source =
      stockView === "all"
        ? stockSummary
        : stockSummary.filter(
          (r) => normalizeCategory(r.category) === normalizeCategory(stockView)
        );

    source.forEach((row) => {
      const key = normalizeCategory(row.category);
      totals[key] += Number(row.totalAvailable ?? 0);
    });

    return totals;
  }, [stockSummary, stockView]);


  const lowStockTotals = useMemo(() => {
    const totals = { granite: 0, quartz: 0, monuments: 0 };

    const source =
      stockView === "all"
        ? lowStockAlerts
        : lowStockAlerts.filter(
          (r) => normalizeCategory(r.category) === normalizeCategory(stockView)
        );

    source.forEach((row) => {
      const key = normalizeCategory(row.category);
      totals[key] += 1;
    });

    return totals;
  }, [lowStockAlerts, stockView]);


  const soldTotals = useMemo(() => {
    const totals = { granite: 0, quartz: 0, monuments: 0 };

    const source =
      stockView === "all"
        ? stockSummary
        : stockSummary.filter(
          (r) => normalizeCategory(r.category) === normalizeCategory(stockView)
        );

    source.forEach((row) => {
      const key = normalizeCategory(row.category);
      totals[key] += Number(row.totalSold ?? 0);
    });

    return totals;
  }, [stockSummary, stockView]);

  const addDisplayValues = (list) => {
    return list.map((d) => ({
      ...d,
      displayValue: d.value > 0 ? d.value : 0,
    }));
  };

  const categoryChartData = useMemo(() => {
    return addDisplayValues([
      { key: "monuments", name: "Monuments", value: categoryTotals.monuments, color: categorySwatch("monuments") },
      { key: "granite", name: "Granite", value: categoryTotals.granite, color: categorySwatch("granite") },
      { key: "quartz", name: "Quartz", value: categoryTotals.quartz, color: categorySwatch("quartz") },
    ]);
  }, [categoryTotals]);

  const lowChartData = useMemo(() => {
    return addDisplayValues([
      { key: "monuments", name: "Monuments", value: lowStockTotals.monuments, color: categorySwatch("monuments") },
      { key: "granite", name: "Granite", value: lowStockTotals.granite, color: categorySwatch("granite") },
      { key: "quartz", name: "Quartz", value: lowStockTotals.quartz, color: categorySwatch("quartz") },
    ]);
  }, [lowStockTotals]);



  const soldChartData = useMemo(() => {
    return addDisplayValues([
      { key: "monuments", name: "Monuments", value: soldTotals.monuments, color: categorySwatch("monuments") },
      { key: "granite", name: "Granite", value: soldTotals.granite, color: categorySwatch("granite") },
      { key: "quartz", name: "Quartz", value: soldTotals.quartz, color: categorySwatch("quartz") },
    ]);
  }, [soldTotals]);


  const totalUnits = useMemo(
    () => categoryChartData.reduce((acc, d) => acc + (d.value || 0), 0),
    [categoryChartData]
  );
  const totalLow = useMemo(
    () => lowChartData.reduce((acc, d) => acc + (d.value || 0), 0),
    [lowChartData]
  );
  const totalSold = useMemo(
    () => soldChartData.reduce((acc, d) => acc + (d.value || 0), 0),
    [soldChartData]
  );

  const renderPieTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0];
    const fill = item.payload?.color || item.fill;
    const rawValue = item.payload?.value ?? item.value ?? 0;
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip__title">
          <span className="report-legend__dot" style={{ background: fill }} />
          {item.name}
        </div>
        <div className="chart-tooltip__value">
          {Number(rawValue).toLocaleString("en-IN")} units
        </div>
      </div>
    );
  };






  useEffect(() => {
    async function loadReport() {

      // STOCK SUMMARY
      if (activeReport === "stock-summary") {
        await fetchStockSummaryData();
      }

      // LOW STOCK ALERTS

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


  const withCategoryColumn = (columns, index = 0) => {
    if (!showAll) return columns;
    const categoryColumn = { key: "category", label: "Category" };
    return [
      ...columns.slice(0, index),
      categoryColumn,
      ...columns.slice(index),
    ];
  };

  const stockSummaryColumns = withCategoryColumn(
    [
      { key: "totalQuantity", label: "Total Quantity" },
      { key: "totalOut", label: "Total Out" },
      { key: "totalSold", label: "Total Sold" },
      { key: "totalReturned", label: "Total Returned" },
      { key: "totalAvailable", label: "Total Available" },
    ],
    0
  );

  const batchWiseColumns = withCategoryColumn(
    [
      {
        key: "batchCode",
        label: "Batch Code",
        render: (row) => (
          <button className="link-btn" onClick={() => openBatchDetails(row.batchCode)}>
            {row.batchCode}
          </button>
        ),
      },
      { key: "batchQuantity", label: "Batch Quantity" },
      { key: "sold", label: "Sold" },
      { key: "out", label: "Out" },
      { key: "returned", label: "Returned" },
      { key: "available", label: "Available" },
    ],
    1
  );

  const itemWiseColumns = withCategoryColumn(
    [
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
      { key: "productName", label: "Product Name" },
      { key: "size", label: "Size" },
      { key: "colour", label: "Colour", render: (row) => row.colour || row.color || "-" },
      { key: "status", label: "Status", render: (row) => <StatusPill status={row.status} /> },
      { key: "clientName", label: "Client Name" },
      { key: "deliveryOrderNo", label: "Delivery Order No" },
      { key: "createdDate", label: "Created Date" },
    ],
    2
  );

  const salesColumns = withCategoryColumn(
    [
      { key: "batchCode", label: "Batch Code" },
      { key: "itemId", label: "Item ID" },
      { key: "productName", label: "Product Name" },
      { key: "size", label: "Size" },
      { key: "colour", label: "Colour", render: (row) => row.colour || row.color || "-" },
      { key: "clientName", label: "Client Name" },
      { key: "deliveryOrderNo", label: "Delivery Order No" },
      { key: "saleDate", label: "Sale Date" },
      { key: "deliveryMode", label: "Delivery Mode" },
    ],
    2
  );

  const returnsColumns = withCategoryColumn(
    [
      { key: "batchCode", label: "Batch Code" },
      {
        key: "itemIds",
        label: "Item IDs",
        render: (row) => row.itemIds.join(", "),
        getValue: (row) => row.itemIds.join(" | "),
      },
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
    ],
    2
  );

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

  const lowStockColumns = withCategoryColumn(
    [
      { key: "batchCode", label: "Batch Code" },
      { key: "itemName", label: "Item Name" },
      { key: "availableQuantity", label: "Available Quantity" },
      { key: "threshold", label: "Threshold" },
      { key: "status", label: "Status (LOW STOCK)", render: (row) => <StatusPill status={row.status} /> },
    ],
    2
  );

  const paymentColumns = [
    { key: "poInvoiceNumber", label: "PO Invoice Number" },
    { key: "vendorName", label: "Vendor Name" },
    { key: "paymentDate", label: "Payment Date" },
    {
      key: "amount",
      label: "Amount",
      render: (row) =>
        `${row.currency || "INR"} ${(row.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,

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
      rows: filteredLowStock,   // ✅ FIX
      filename: "low-stock-alert-report",
      stockFilter: false,
      categoryFilter: true,     // ✅ ENABLE category filter
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
          <SelectMenu
            value={stockView}
            onChange={setStockView}
            className="stock-filter-select"
            options={[
              { label: "Show all", value: "all" },
              { label: "Monuments", value: "monuments" },
              { label: "Granite", value: "granite" },
              { label: "Quartz", value: "quartz" },
            ]}
            ariaLabel="Stock focus"
          />
          <p className="filter-hint">Filter reports by category.</p>
        </div>
      </header>

      <div className="reports-grid">
        <div className="report-stats card">
          <p className="eyebrow">Quick stats</p>
          <div className="report-stats__row donuts-row">
            <div className="donut-card">
              <div className="donut-title">Category Distribution</div>
              <div className="donut-chart-box">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      dataKey="displayValue"
                      nameKey="name"
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {categoryChartData.map((entry, idx) => (
                        <Cell key={`cat-${entry.key}-${idx}`} fill={entry.color} stroke="#fff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <ReTooltip content={renderPieTooltip} offset={12} />
                    <ReLegend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="donut-card">
              <div className="donut-title">Low Stock (Category)</div>
              <div className="donut-chart-box">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={(lowChartData)}
                      dataKey="displayValue"
                      nameKey="name"
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {(lowChartData).map((entry, idx) => (
                        <Cell key={`low-${entry.key}-${idx}`} fill={entry.color} stroke="#fff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <ReTooltip content={renderPieTooltip} offset={12} />
                    <ReLegend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="donut-card">
              <div className="donut-title">Units Sold (Category)</div>
              <div className="donut-chart-box">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={(soldChartData)}
                      dataKey="displayValue"
                      nameKey="name"
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {(soldChartData).map((entry, idx) => (
                        <Cell key={`sold-${entry.key}-${idx}`} fill={entry.color} stroke="#fff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <ReTooltip content={renderPieTooltip} offset={12} />
                    <ReLegend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
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

            <div className="table-wrap modal-table-scroll excel-table-wrap" style={{ marginTop: "10px" }}>
              <table className="table excel-table">
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
                    {showAll && <th>Category</th>}
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
                        {showAll && (
                          <td>{item.category || item.Category || batchDetail.summary?.category || "-"}</td>
                        )}
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
