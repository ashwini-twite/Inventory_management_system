import React from "react";

export default function POCategoryCard({ title, description, image, metrics, onAdd, onList }) {
  const summary = metrics || { total: 0, pending: 0, completed: 0 };

  return (
    <div className="manage-card">
      <div className="po-category-media">
        <img src={image} className="manage-card-img" alt={title} />
      </div>

      <h3 className="manage-card-title">{title}</h3>
      <p className="manage-card-description">{description}</p>

      <div className="po-kpi-row">
        <div className="po-kpi">
          <span className="po-kpi-label">Total Orders</span>
          <span className="po-kpi-value">{summary.total}</span>
        </div>
        <div className="po-kpi">
          <span className="po-kpi-label">Pending</span>
          <span className="po-kpi-badge pending">{summary.pending}</span>
        </div>
        <div className="po-kpi">
          <span className="po-kpi-label">Completed</span>
          <span className="po-kpi-badge completed">{summary.completed}</span>
        </div>
      </div>

      <div className="po-category-actions">
        <button className="po-action-primary" onClick={onAdd}>
          Create Purchase Order
        </button>

        <button className="po-action-secondary" onClick={onList}>
          View Orders
        </button>
      </div>
    </div>
  );
}
