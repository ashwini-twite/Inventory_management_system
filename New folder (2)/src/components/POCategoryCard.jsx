import React from "react";

export default function POCategoryCard({ title, description, image, onAdd, onList }) {
  return (
    <div className="manage-card">
      <img src={image} className="manage-card-img" alt={title} />

      <h3 className="manage-card-title">{title}</h3>
      <p className="manage-card-description">{description}</p>

      <div className="po-category-actions">
        <button className="po-btn-primary" onClick={onAdd}>
          Add New Order
        </button>

        <button className="po-btn-secondary" onClick={onList}>
          Item List
        </button>
      </div>
    </div>
  );
}
