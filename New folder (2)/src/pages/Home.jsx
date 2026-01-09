import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, Tooltip as ReTooltip, Legend as ReLegend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import QuickActionCard from "../components/QuickActionCard";
import Modal from "../components/Modal";
import {
  ClipboardList,
  Users,
  BarChart3,
  ScanLine,
  Package,
  Layers,
  TrendingUp,
  Repeat,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import "../styles/home.css";
import { categoryColor, metricColor } from "../styles/colorTokens";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

/* ---------------- CHART HELPERS ---------------- */
const formatNumber = (value) => Number(value || 0).toLocaleString("en-IN");

const normalizeKey = (value) => (value || "").toString().toLowerCase().replace(/[^a-z0-9]+/g, "-");

const statusGradients = {
  available: {
    css: metricColor("available", "all"),
  },
  sold: {
    css: metricColor("sold", "all"),
  },
  returned: {
    css: metricColor("returned", "all"),
  },
};

const Legend = ({ data, showValue = true }) => (
  <div className="chart-legend">
    {data.map((item, idx) => (
      <div key={`${item.label}-${idx}`} className="chart-legend__item">
        <span
          className="chart-legend__swatch"
          style={{ background: item.swatch || item.color || categoryColor(item.label || idx) }}
        />
        <span className="chart-legend__label">
          {showValue ? `${item.label}: ${formatNumber(item.value)}` : item.label}
        </span>
      </div>
    ))}
  </div>
);

const DonutChart = ({ data, totalValue, centerLabel, dark = false, size = 180 }) => {
  const [tooltip, setTooltip] = useState(null);
  const wrapperRef = useRef(null);
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((acc, item) => acc + (item.value || 0), 0) || 1;
  let offset = 0;
  const gap = 4;

  return (
    <div
      className={`donut-chart ${dark ? "donut-chart--dark" : ""}`}
      ref={wrapperRef}
      style={{ "--donut-size": `${size}px` }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="donut-svg" role="img" aria-label="Total stock by category">
        <defs>
          {data.map((item) => (
            <linearGradient key={item.gradientKey} id={`donut-${item.gradientKey}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={item.color} />
              <stop offset="100%" stopColor={item.color} />
            </linearGradient>
          ))}
        </defs>
        <circle
          className="donut-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
        />
        {data.map((item, idx) => {
          const value = item.value || 0;
          const length = (value / total) * circumference;
          const dash = `${Math.max(length - gap, 0)} ${circumference - length + gap}`;
          const dashoffset = -offset;
          offset += length;
          const gradientId = item.gradientKey || "default";
          const percent = Math.round((value / total) * 100);
          return (
            <circle
              key={`${item.label}-${idx}`}
              className="donut-slice"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={`url(#donut-${gradientId})`}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={dashoffset}
              onMouseMove={(event) => {
                if (!wrapperRef.current) return;
                const rect = wrapperRef.current.getBoundingClientRect();
                setTooltip({
                  label: item.label,
                  value,
                  percent,
                  x: event.clientX - rect.left,
                  y: event.clientY - rect.top,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          );
        })}
      </svg>
      <div className="donut-center">
        <div className="donut-center__value">{formatNumber(totalValue)}</div>
        {centerLabel ? (
          <div className="donut-center__label">{centerLabel}</div>
        ) : null}
      </div>
      {tooltip && (
        <div
          className="chart-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="chart-tooltip__title">{tooltip.label}</div>
          <div className="chart-tooltip__value">Stock: {formatNumber(tooltip.value)} Units</div>
        </div>
      )}
    </div>
  );
};

const RadialProgressChart = ({ value, total }) => {
  const [animate, setAnimate] = useState(false);
  const size = 180;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const offset = circumference - (percent / 100) * circumference;

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [value, total]);

  return (
    <div className="radial-chart">
      <svg viewBox={`0 0 ${size} ${size}`} className="radial-svg" role="img" aria-label="Available stock">
        <defs>
          <linearGradient id="radial-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={statusGradients.available.css} />
            <stop offset="100%" stopColor={statusGradients.available.css} />
          </linearGradient>
        </defs>
        <circle
          className="radial-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
        />
        <circle
          className="radial-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={animate ? offset : circumference}
          stroke="url(#radial-gradient)"
        />
      </svg>
      <div className="radial-center">
        <div className="radial-center__value">{formatNumber(value)}</div>
        <div className="radial-center__label">Available Units</div>
      </div>
    </div>
  );
};

const buildLinePath = (points) => {
  if (points.length === 0) return "";
  const smoothing = 0.2;
  const controlPoint = (current, previous, next, reverse) => {
    const p = previous || current;
    const n = next || current;
    const o = {
      length: Math.hypot(n.x - p.x, n.y - p.y),
      angle: Math.atan2(n.y - p.y, n.x - p.x) + (reverse ? Math.PI : 0),
    };
    const length = o.length * smoothing;
    return {
      x: current.x + Math.cos(o.angle) * length,
      y: current.y + Math.sin(o.angle) * length,
    };
  };

  return points.reduce((path, point, i, a) => {
    if (i === 0) return `M ${point.x},${point.y}`;
    const cps = controlPoint(a[i - 1], a[i - 2], point, false);
    const cpe = controlPoint(point, a[i - 1], a[i + 1], true);
    return `${path} C ${cps.x},${cps.y} ${cpe.x},${cpe.y} ${point.x},${point.y}`;
  }, "");
};

const GroupedBarChart = ({ data, onClick }) => {
  const navigate = useNavigate();

  const handleChartClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate('/reports', { state: { report: 'sales' } });
    }
  };

  return (
    <div
      className="grouped-bar-chart-recharts"
      onClick={handleChartClick}
      style={{ cursor: "pointer", width: "100%", height: 220 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          barGap={4}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
            interval={0}
          />
          <YAxis
            hide
          />
          <ReTooltip
            cursor={{ fill: 'rgba(0,0,0,0.05)' }}
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="chart-tooltip">
                    <div className="chart-tooltip__title">{label}</div>
                    {payload.map((entry, index) => (
                      <div key={index} className="chart-tooltip__value" style={{ color: entry.color, fontWeight: 600 }}>
                        {entry.name}: {entry.value} Units
                      </div>
                    ))}
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar
            dataKey="monuments"
            name="Monuments"
            fill={categoryColor("monuments", "dark")}
            radius={[4, 4, 0, 0]}
            barSize={14}
          />
          <Bar
            dataKey="granite"
            name="Granite"
            fill={categoryColor("granite", "dark")}
            radius={[4, 4, 0, 0]}
            barSize={14}
          />
          <Bar
            dataKey="quartz"
            name="Quartz"
            fill={categoryColor("quartz", "base")}
            radius={[4, 4, 0, 0]}
            barSize={14}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

/* ---------------- HOME ---------------- */
export default function Home() {
  const [selectedKpi, setSelectedKpi] = useState(null);
  const navigate = useNavigate();
  const [selectedQuarter, setSelectedQuarter] = useState("jan-apr");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  /* ---------------- STATE ---------------- */
  const [kpis, setKpis] = useState([]);
  const [categoryStats, setCategoryStats] = useState({});
  const [stockCategory, setStockCategory] = useState([]);
  const [stockStatus, setStockStatus] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [monthlyLabels, setMonthlyLabels] = useState([]);

  /* ---------------- LOAD DASHBOARD DATA ---------------- */
  useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await fetch(`${API_BASE}/dashboard/`);
        if (!res.ok) throw new Error("Failed to load dashboard");

        const data = await res.json();

        const backStats = data.kpis;
        setKpis([
          { key: "total", label: "Total Stock", value: backStats.total, unit: "Units", Icon: Layers },
          { key: "available", label: "Available Stock", value: backStats.available, unit: "Units", Icon: ShieldCheck },
          { key: "weekly", label: "Weekly Sales", value: backStats.weekly, unit: "Units", Icon: Package },
          { key: "sold", label: "Sold This Month", value: backStats.sold, unit: "Units", Icon: TrendingUp },
          { key: "returns", label: "Returns This Month", value: backStats.returns, unit: "Units", Icon: Repeat },
          { key: "low", label: "Low Stock Count", value: backStats.low, unit: "Batches", Icon: AlertTriangle },
        ]);

        setCategoryStats(data.category_stats);

        setStockCategory(data.stock_category.map(item => ({
          ...item,
          color: categoryColor(item.label, "base")
        })));

        const baseStatus = ["Available", "Sold", "Returned"].map((label) => ({
          label,
          value: 0,
        }));
        const statusLookup = {};
        (data.stock_status || []).forEach((item) => {
          const key = normalizeKey(item.label);
          statusLookup[key] = Number(item.value || 0);
        });
        setStockStatus(
          baseStatus.map((item) => {
            const key = normalizeKey(item.label);
            return {
              ...item,
              value: statusLookup[key] ?? 0,
              color: metricColor(key, "all"),
            };
          })
        );

        setMonthlySales(data.monthly_sales);
        setMonthlyLabels(data.monthly_sales.map(m => m.label));

      } catch (err) {
        console.error("Dashboard error:", err);
      }
    }
    loadDashboard();
  }, []);

  const stockStatusLegend = useMemo(() => {
    return stockStatus.map((item) => {
      const key = normalizeKey(item.label);
      return {
        ...item,
        swatch: statusGradients[key]?.css || statusGradients.available.css,
      };
    });
  }, [stockStatus]);

  const availableItem = useMemo(
    () => stockStatus.find((item) => normalizeKey(item.label) === "available") || { value: 0 },
    [stockStatus]
  );
  const stockStatusTotal = useMemo(
    () => stockStatus.reduce((acc, item) => acc + (item.value || 0), 0) || 1,
    [stockStatus]
  );
  const stockStatusChartData = useMemo(
    () =>
      stockStatus.map((item, idx) => ({
        ...item,
        color: item.color || statusGradients[normalizeKey(item.label)]?.css,
        gradientKey: `${normalizeKey(item.label) || "status"}-${idx}`,
      })),
    [stockStatus]
  );

  const monthlySeries = useMemo(
    () =>
      monthlySales.map((item) => ({
        ...item,
        value: item.value ?? item.units ?? item.total ?? item.sold ?? 0,
      })),
    [monthlySales]
  );

  const quarterRanges = useMemo(
    () => ({
      "jan-apr": { label: "Jan–Apr", months: [0, 1, 2, 3] },
      "may-aug": { label: "May–Aug", months: [4, 5, 6, 7] },
      "sep-dec": { label: "Sep–Dec", months: [8, 9, 10, 11] },
    }),
    []
  );

  const getMonthIndex = (label) => {
    const raw = (label || "").toString().trim().toLowerCase();
    if (!raw) return null;
    const monthMap = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
      may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
      sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
    };
    const token = raw.split(/[^a-z]/).find(Boolean);
    return token ? monthMap[token] : null;
  };

  const getYearFromLabel = (label) => {
    const raw = (label || "").toString();
    const match = raw.match(/(19|20)\d{2}/);
    return match ? Number(match[0]) : null;
  };

  const availableYears = useMemo(() => {
    const current = new Date().getFullYear();
    return [current, current - 1, current - 2];
  }, []);

  useEffect(() => {
    if (!availableYears.length) return;
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const quarterMonths = quarterRanges[selectedQuarter]?.months || [];

  const quarterlySeries = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthsToShow = quarterRanges[selectedQuarter]?.months || [];

    return monthsToShow.map(mIdx => {
      const monthLabel = monthNames[mIdx];
      const fullLabel = `${monthLabel} ${selectedYear}`;

      // Find matching data from backend
      const match = monthlySeries.find(item => {
        const label = item.label || "";
        return getMonthIndex(label) === mIdx && getYearFromLabel(label) === selectedYear;
      });

      return {
        label: fullLabel,
        data: match || { granite: 0, quartz: 0, monuments: 0 }
      };
    });
  }, [monthlySeries, selectedQuarter, selectedYear, quarterRanges]);

  const quarterlyData = useMemo(() => {
    const getCategoryValue = (raw, key) => {
      const direct = raw?.[key];
      if (direct !== undefined) return direct;
      const lowerKey = key.toLowerCase();
      const match = Object.entries(raw || {}).find(([k]) => {
        const safeKey = k.toLowerCase();
        if (lowerKey === "granite") return safeKey.includes("granite");
        if (lowerKey === "quartz") return safeKey.includes("quartz") || safeKey.includes("quart");
        if (lowerKey === "monuments") return safeKey.includes("monument");
        return false;
      });
      return match ? match[1] : 0;
    };

    return quarterlySeries.map((item) => {
      const raw = item.data || {};
      return {
        label: item.label,
        granite: getCategoryValue(raw, "granite"),
        quartz: getCategoryValue(raw, "quartz"),
        monuments: getCategoryValue(raw, "monuments"),
      };
    });
  }, [quarterlySeries]);

  /* ---------------- UI ---------------- */
  const pieChartData = useMemo(() => {
    const base = {
      monuments: { key: "monuments", label: "Monuments", value: 0, color: categoryColor("monuments") },
      granite: { key: "granite", label: "Granite", value: 0, color: categoryColor("granite") },
      quartz: { key: "quartz", label: "Quartz", value: 0, color: categoryColor("quartz") },
    };
    stockCategory.forEach((item) => {
      const key = normalizeKey(item.label);
      if (base[key]) base[key].value = Number(item.value || 0);
    });
    // Return in specific order
    return [base.monuments, base.granite, base.quartz];
  }, [stockCategory]);

  const renderPieTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0];
    const fill = item.payload?.color || item.fill;
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip__title">
          <span className="report-legend__dot" style={{ background: fill }} />
          {item.name}
        </div>
        <div className="chart-tooltip__value">
          {Number(item.value || 0).toLocaleString("en-IN")} units
        </div>
      </div>
    );
  };

  const handleSliceClick = (key) => {
    const param = encodeURIComponent(key);
    navigate(`/reports?category=${param}`);
  };

  const handleAvailableCardClick = () => {
    navigate("/reports");
  };

  return (
    <div className="home-page">
      {/* QUICK ACTIONS */}
      <section className="home-quick-actions">
        <div className="quick-actions-header">
          <h2 className="section-title">Quick Actions</h2>
          <p className="quick-actions-subtitle">Common workflows</p>
        </div>
        <div className="quick-grid">
          <QuickActionCard label="Purchase order" Icon={ClipboardList} path="/purchase-orders" />
          <QuickActionCard label="Manage Stock" Icon={ClipboardList} path="/manage-stock" />
          <QuickActionCard label="Client Details" Icon={Users} path="/clients" />
          <QuickActionCard label="Reports" Icon={BarChart3} path="/reports" />
          <QuickActionCard label="Deliver Slabs (Scan QR)" Icon={ScanLine} path="/logistics/scan" />
        </div>
      </section>

      {/* CHARTS */}
      <section className="charts-grid charts-grid--top">
        <div className="chart-card card">
          <div className="chart-card__header">
            <h3>Overall Stock Breakdown</h3>
            <p>Category totals (units)</p>
          </div>
          <div className="chart-card__body">
            <div
              style={{
                width: "100%",
                height: 300,
                position: "relative",
                overflow: "visible",
                display: "grid",
                placeItems: "center",
              }}
            >
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={60}
                    outerRadius={105}
                    paddingAngle={3}
                    cursor="pointer"
                    onClick={(_, idx) => {
                      const target = pieChartData[idx]?.key;
                      if (target) handleSliceClick(target);
                    }}
                  >
                    {pieChartData.map((entry, idx) => (
                      <Cell key={`home-pie-${entry.key}-${idx}`} fill={entry.color} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <ReTooltip content={renderPieTooltip} offset={12} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="home-pie-legend">
              {pieChartData.map((entry) => (
                <div key={`legend-${entry.key}`} className="home-pie-legend__item">
                  <span className="home-pie-legend__dot" style={{ background: entry.color }} />
                  <span className="home-pie-legend__label">
                    {entry.label} — {entry.value?.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="chart-card card chart-card--link chart-card--status"
          role="button"
          tabIndex={0}
          onClick={handleAvailableCardClick}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleAvailableCardClick();
            }
          }}
        >
          <div className="chart-card__header">
            <h3>Available Stock Category</h3>
            <p>Current availability overview</p>
          </div>
          <div className="chart-card__body chart-flex">
            <DonutChart
              data={stockStatusChartData}
              totalValue={stockStatusTotal}
              centerLabel="Total Units"
              size={210}
            />
            <Legend data={stockStatusLegend} />
          </div>
        </div>

        <div className="chart-card card">
          <div className="chart-card__header chart-card__header-row">
            <div className="chart-card__title-group">
              <h3>Monthly Units Sold</h3>
              <p>Trend over the last 12 months</p>
            </div>
            <div className="chart-filter">
              <div className="chart-filter__item">
                <label className="chart-filter__label" htmlFor="year-select">Year</label>
                <select
                  id="year-select"
                  className="chart-filter__select"
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(Number(event.target.value))}
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div className="chart-filter__item">
                <label className="chart-filter__label" htmlFor="quarter-select">Quarter</label>
                <select
                  id="quarter-select"
                  className="chart-filter__select"
                  value={selectedQuarter}
                  onChange={(event) => setSelectedQuarter(event.target.value)}
                >
                  {Object.entries(quarterRanges).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="chart-card__body">
            <GroupedBarChart
              data={quarterlyData}
            />
            <div className="chart-legend-inline">
              <span><i className="swatch" style={{ background: categoryColor("monuments") }} /> Monuments</span>
              <span><i className="swatch" style={{ background: categoryColor("granite") }} /> Granite</span>
              <span><i className="swatch" style={{ background: categoryColor("quartz") }} /> Quartz</span>
            </div>
          </div>
        </div>
      </section>

      {/* KPI MINI CARDS (below charts) */}
      <section className="home-kpi-row">
        {kpis.map((item) => (
          <button
            key={item.key}
            type="button"
            className="home-kpi-card"
            onClick={() => setSelectedKpi(item)}
          >
            <span className="home-kpi-icon">
              <item.Icon size={20} />
            </span>
            <span className="home-kpi-text">
              <span className="home-kpi-label">{item.label}</span>
              <span className="home-kpi-value">
                {formatNumber(item.value)} {item.unit}
              </span>
            </span>
          </button>
        ))}
      </section>

      <Modal
        open={Boolean(selectedKpi)}
        onClose={() => setSelectedKpi(null)}
        title={selectedKpi?.label}
        subtitle="Breakdown by category"
        rows={(() => {
          if (!selectedKpi) return [];

          const metricKeyMap = {
            total: "total",
            available: "available",
            weekly: "sold",
            sold: "sold",
            returns: "returned",
            low: "lowBatches",
          };
          const metricKey = metricKeyMap[selectedKpi.key] || "total";
          const entries = Object.keys(categoryStats || {});

          if (entries.length === 0) {
            return [
              {
                label: selectedKpi.label,
                value: selectedKpi.value,
                unit: selectedKpi.unit,
              },
            ];
          }

          const order = ["monuments", "granite", "quartz"];

          return entries
            .sort((a, b) => order.indexOf(a.toLowerCase()) - order.indexOf(b.toLowerCase()))
            .map((cat) => ({
              label: cat,
              value: categoryStats[cat]?.[metricKey] ?? 0,
              unit: selectedKpi.unit,
            }));
        })()}
      />
    </div>
  );
}
