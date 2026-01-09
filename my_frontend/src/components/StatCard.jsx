import React from "react";
import "../styles/cards.css";

export default function StatCard({ label, value, unit, Icon, onClick }) {
  return (
    <div
      className="stat-card"
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div className="stat-icon">
        {Icon && <Icon size={32} color="#ffffff" />}
      </div>

      <div className="stat-text">
        <p className="stat-label">{label}</p>
        <p className="stat-value">
          {value} <span className="stat-unit">{unit}</span>
        </p>
      </div>
    </div>
  );
}
