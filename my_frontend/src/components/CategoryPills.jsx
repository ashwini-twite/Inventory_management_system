import React from "react";
import "../styles/categoryPills.css";

const DEFAULT_OPTIONS = ["Monuments", "Granite", "Quartz"];

export default function CategoryPills({ value, onChange, options = DEFAULT_OPTIONS, className = "" }) {
  return (
    <div className={`category-pill-group ${className}`}>
      {options.map((option) => {
        const optionValue = typeof option === "string" ? option : option.value;
        const optionLabel = typeof option === "string" ? option : option.label;
        const isActive = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            className={`category-pill ${isActive ? "active" : ""}`}
            onClick={() => onChange(optionValue)}
          >
            {optionLabel}
          </button>
        );
      })}
    </div>
  );
}
