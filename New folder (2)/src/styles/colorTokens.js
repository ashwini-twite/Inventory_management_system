// Central color system for category-driven charts.
// Keep palette consistent across Home + Reports.
export const categoryPalette = {
  granite: {
    base: "#1797b8",
    light: "#D1EAF1",
    dark: "#127893",
  },
  monuments: {
    base: "#faaa25",
    light: "#FEEBCB",
    dark: "#C8881E",
  },
  quartz: {
    base: "#3960e6",
    light: "#D7DFFB",
    dark: "#2E4DB8",
  },
  default: {
    base: "#64748b",
    light: "#e2e8f0",
    dark: "#334155",
  },
};

export const neutralRing = "#e2e8f0";

export const normalizeCategory = (value) => {
  const raw = (value || "").toString().toLowerCase();
  if (raw.includes("monument")) return "monuments";
  if (raw.includes("quartz") || raw.includes("quart")) return "quartz";
  if (raw.includes("granite") || raw.includes("granit") || raw.includes("granitz")) return "granite";
  return "default";
};

export const categoryColor = (category, tone = "base") => {
  const key = normalizeCategory(category);
  const palette = categoryPalette[key] || categoryPalette.default;
  return palette[tone] || palette.base;
};

export const metricColor = (metric, category) => {
  const key = normalizeCategory(category);
  const palette = categoryPalette[key] || categoryPalette.default;

  // Dedicated status palette for "Show all" so it doesn't reuse category colors
  if (key === "default") {
    const statusPalette = {
      available: "#111827",
      low: "#f59e0b",
      sold: "#a9d4eb",
      returned: "#9ca3af",
    };
    return statusPalette[metric] || palette.base;
  }

  // Category-specific shades: keep family consistent per category
  if (metric === "available") return palette.dark;
  if (metric === "low") return palette.base;
  if (metric === "sold") return palette.light;
  if (metric === "returned") return palette.light;
  return palette.base;
};
