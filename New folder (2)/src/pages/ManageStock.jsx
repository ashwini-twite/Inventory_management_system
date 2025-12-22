import React from "react";
import { useNavigate } from "react-router-dom";
import ItemCategoryCard from "../components/ItemCategoryCard";
import { Boxes, ClipboardList, Truck } from "lucide-react";

import "../styles/manageStock.css";

export default function ManageStock() {
  const navigate = useNavigate();

  const cards = [
    {
      title: "Products",
      description: "Review and manage product batches and stock levels.",
      icon: <Boxes size={24} strokeWidth={1.7} />,
      onClick: () => navigate("/manage-stock/products"),
    },
    {
      title: "Stock Counts",
      description: "Perform and review real-time stock count checks.",
      icon: <ClipboardList size={24} strokeWidth={1.7} />,
      onClick: () => navigate("/manage-stock/counts"),
    },
    {
      title: "Dispatch Stocks",
      description: "Track and manage stocks queued for dispatch.",
      icon: <Truck size={24} strokeWidth={1.7} />,
      onClick: () => navigate("/manage-stock/reserved"),
    },
  ];

  return (
    <div className="manage-landing">
      <div className="manage-landing__header">
        <h1 className="section-title">Manage Stock</h1>
      </div>

      <div className="manage-landing__grid">
        {cards.map((card) => (
          <button
            key={card.title}
            className="manage-landing__card"
            onClick={card.onClick}
            type="button"
          >
            <div className="manage-landing__icon">{card.icon}</div>
            <div className="manage-landing__title">{card.title}</div>
            <div className="manage-landing__desc">{card.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
