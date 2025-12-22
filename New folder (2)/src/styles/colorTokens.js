// Central color system for category-driven charts.
// Keep palette consistent across Home + Reports.
export const categoryPalette = {
  granite: {
    base: "#1f4f78",
    light: "#3f6c94",
    dark: "#143b5d",
  },
  monuments: {
    base: "#e64b73",
    light: "#f58aad",
    dark: "#c7355b",
  },
  quartz: {
    base: "#f6c14b",
    light: "#ffd879",
    dark: "#d9a122",
  },
  default: {
    base: "#6f7f9a",
    light: "#98a9c4",
    dark: "#4c5b76",
  },
};

export const neutralRing = "#e8ecf5";

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
      available: "#2a9d8f", // teal
      low: "#e67e22",       // burnt orange
      sold: "#c2410c",      // brick
      returned: "#9c27b0",  // purple
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
