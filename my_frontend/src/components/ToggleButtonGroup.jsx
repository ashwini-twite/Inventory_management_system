import React from "react";

export default function ToggleButtonGroup({ options, activeValue }) {
  return (
    <div className="po-toggle-group" role="tablist">
      {options.map((option) => {
        const isActive = option.value === activeValue;
        return (
          <button
            key={option.value}
            type="button"
            className={`po-toggle-btn ${isActive ? "active" : "inactive"}`}
            onClick={option.onClick}
            aria-pressed={isActive}
          >
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
