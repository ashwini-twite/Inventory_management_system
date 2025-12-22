
import React, { useEffect, useState } from "react";
import StatCard from "../components/StatCard";
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
// import { supabase } from "../supabaseClient"; // REMOVED
import "../styles/home.css";
import { categoryColor, metricColor } from "../styles/colorTokens";

const API_BASE = "http://127.0.0.1:8000";

/* ---------------- CHART HELPERS (UNCHANGED) ---------------- */
const buildConicGradient = (data) => {
  const total = data.reduce((acc, item) => acc + item.value, 0) || 1;
  let current = 0;
  return `conic-gradient(${data
    .map((item, idx) => {
      const start = (current / total) * 100;
      current += item.value;
      const end = (current / total) * 100;
      const color = item.color || categoryColor(item.label || idx);
      return `${color} ${start}% ${end}%`;
    })
    .join(", ")})`;
};

const Legend = ({ data }) => (
  <div className="chart-legend">
    {data.map((item, idx) => (
      <div key={idx} className="chart-legend__item">
        <span
          className="chart-legend__swatch"
          style={{ background: item.color || categoryColor(item.label || idx) }}
        />
        <span className="chart-legend__label">
          {item.label}: {item.value}
        </span>
      </div>
    ))}
  </div>
);

const PieChart = ({ data }) => (
  <div className="pie-chart" style={{ backgroundImage: buildConicGradient(data) }} />
);

const DonutChart = ({ data, centerLabel }) => (
  <div className="donut-chart__wrap">
    <div className="donut-chart" style={{ backgroundImage: buildConicGradient(data) }} />
    <div className="donut-chart__center">
      <span>{centerLabel}</span>
    </div>
  </div>
);

/* ---------------- HOME ---------------- */
export default function Home() {
  const [selectedKpi, setSelectedKpi] = useState(null);

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

        // Format KPIs
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

        // Format Charts
        setStockCategory(data.stock_category.map(item => ({
          ...item,
          color: categoryColor(item.label, "base")
        })));

        setStockStatus(data.stock_status.map(item => {
          let key = item.label.toLowerCase();
          if (key === "available") key = "available";
          else if (key === "sold") key = "sold";
          else if (key === "returned") key = "returned";

          return {
            ...item,
            color: metricColor(key, "all")
          };
        }));

        setMonthlySales(data.monthly_sales);
        setMonthlyLabels(data.monthly_sales.map(m => m.label));

      } catch (err) {
        console.error("Dashboard error:", err);
      }
    }
    loadDashboard();
  }, []);

  /* ---------------- UI ---------------- */
  return (
    <div className="home-page">
      {/* QUICK ACTIONS */}
      <section className="home-quick-actions">
        <h2 className="section-title">Quick Actions</h2>
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
          <h3>Overall Stock Breakdown</h3>
          <div className="chart-flex">
            <PieChart data={stockCategory} />
            <Legend data={stockCategory} />
          </div>
        </div>

        <div className="chart-card card">
          <h3>Available Stock Category</h3>
          <div className="chart-flex">
            <DonutChart data={stockStatus} centerLabel="Stock" />
            <Legend data={stockStatus} />
          </div>
        </div>

        <div className="chart-card card">
          <h3>Monthly Units Sold</h3>
          <div className="chart-axis">
            {monthlyLabels.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </div>
      </section>

      {/* KPI TILES (moved below charts) */}
      <section className="home-stats-row">
        {kpis.map((item) => (
          <StatCard
            key={item.key}
            label={item.label}
            value={item.value}
            unit={item.unit}
            Icon={item.Icon}
            onClick={() => setSelectedKpi(item)}
          />
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

          return entries
            .sort()
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
