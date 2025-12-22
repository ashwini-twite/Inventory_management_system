import React from "react";
import "../styles/modal.css";

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  rows,
  data = [],
}) {
  if (!open) return null;

  const items = rows || data || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{title}</h2>
        {subtitle ? <p className="modal-subtitle">{subtitle}</p> : null}

        <div className="modal-content">
          {items.map((item, idx) => (
            <div className="modal-card" key={`${item.label}-${idx}`}>
              <div>
                <h3>{item.label}</h3>
                {item.caption ? <p className="modal-caption">{item.caption}</p> : null}
              </div>
              <p className="modal-value">
                {item.value}
                {item.unit ? <span className="modal-unit"> {item.unit}</span> : null}
              </p>
            </div>
          ))}
        </div>

        <button className="modal-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
