import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/cards.css";

export default function QuickActionCard({ label, Icon, path }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (path) {
      navigate(path);
    }
  };

  return (
    <button className="quick-card" onClick={handleClick}>
      <div className="quick-icon">
        {Icon && <Icon size={28} color="#fff" />}
      </div>
      <span className="quick-label">{label}</span>
    </button>
  );
}
