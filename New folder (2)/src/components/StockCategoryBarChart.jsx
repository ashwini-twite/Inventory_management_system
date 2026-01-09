import React, { useMemo, useState, useRef } from "react";
import "../styles/barChart.css";
import { categoryColor } from "../styles/colorTokens";

const formatNumber = (value) => Number(value || 0).toLocaleString("en-IN");

export default function StockCategoryBarChart({
  data = [],
  onBarClick,
  activeKey = "all",
  showLegend = true,
  height = 240,
}) {
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);

  const normalized = useMemo(() => {
    return (data || []).map((item) => {
      const key = (item.key || item.label || "").toString().toLowerCase();
      const palette = {
        base: categoryColor(key, "base"),
        hover: categoryColor(key, "dark"),
      };
      return {
        ...item,
        key,
        label: item.label || key,
        value: Number(item.value || 0),
        color: item.color || palette.base || "#6b7280",
        hoverColor: palette.hover || palette.base || "#6b7280",
      };
    });
  }, [data]);

  const maxValue = Math.max(...normalized.map((d) => d.value), 1);
  const hoveredKey = tooltip?.key || null;

  const handleBarHover = (item, event) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip({
      key: item.key,
      label: item.label,
      value: item.value,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  return (
    <div className="bar-chart">
      <div
        className="bar-chart__plot"
        style={{ minHeight: height }}
        ref={containerRef}
      >
        {normalized.map((item) => {
          const percent = (item.value / maxValue) * 100;
          const isDimmed =
            (hoveredKey && hoveredKey !== item.key) ||
            (activeKey !== "all" && activeKey && activeKey !== item.key);
          const isActive =
            activeKey !== "all" && activeKey && activeKey === item.key;
          return (
            <div key={item.key} className="bar-chart__bar-wrap">
              <div
                className="bar-chart__bar"
                style={{
                  height: `${percent}%`,
                  background: item.color,
                  opacity: isDimmed ? 0.45 : 1,
                  boxShadow: isActive
                    ? `0 8px 18px rgba(0,0,0,0.12), 0 0 0 2px ${item.color}33`
                    : "none",
                  cursor: onBarClick ? "pointer" : "default",
                  "--hover-color": item.hoverColor,
                }}
                role="button"
                tabIndex={0}
                aria-label={`${item.label} ${formatNumber(item.value)} units`}
                onClick={() => onBarClick?.(item.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onBarClick?.(item.key);
                  }
                }}
                onMouseMove={(e) => handleBarHover(item, e)}
                onMouseEnter={(e) => handleBarHover(item, e)}
                onMouseLeave={() => setTooltip(null)}
                data-hovercolor={item.hoverColor}
              />
              <div className="bar-chart__label">{item.label}</div>
              <div className="bar-chart__value">{formatNumber(item.value)}</div>
            </div>
          );
        })}

        {tooltip && (
          <div
            className="bar-chart__tooltip"
            style={{
              left: Math.min(
                Math.max(tooltip.x, 10),
                (containerRef.current?.clientWidth || 0) - 10
              ),
              top: Math.max(tooltip.y - 12, 10),
            }}
          >
            <div className="bar-chart__tooltip-title">{tooltip.label}</div>
            <div className="bar-chart__tooltip-value">
              {formatNumber(tooltip.value)} units
            </div>
          </div>
        )}
      </div>

      {showLegend && (
        <div className="bar-chart__legend">
          {normalized.map((item) => (
            <div key={`legend-${item.key}`} className="bar-chart__legend-item">
              <span
                className="bar-chart__legend-dot"
                style={{ background: item.color }}
              />
              <span className="bar-chart__legend-label">
                {item.label} — {formatNumber(item.value)} units
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
