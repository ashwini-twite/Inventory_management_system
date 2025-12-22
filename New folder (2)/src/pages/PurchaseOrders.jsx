import React from "react";
import { useNavigate } from "react-router-dom";
import POCategoryCard from "../components/POCategoryCard";

import graniteImg from "../assets/image.png";
import quartzImg from "../assets/download4.jfif";
import monumentsImg from "../assets/images2.jfif";

import "../styles/purchaseOrders.css";


export default function PurchaseOrders() {
  const navigate = useNavigate();

  return (
    <div className="po-page">

      {/* PAGE HEADER */}
      <div className="manage-header">
        <h2 className="section-title">Purchase Orders</h2>
        <p className="section-subtitle">
          Select a category to create or view purchase orders
        </p>
      </div>

      {/* CORRECT GRID */}
      <div className="po-category-card-wrapper">

        <POCategoryCard
          title="Granite"
          description="Create new orders and manage existing granite purchase orders."
          image={graniteImg}
          onAdd={() =>
            navigate("/purchase-orders/granite", { state: { view: "form" } })
          }
          onList={() =>
            navigate("/purchase-orders/granite", { state: { view: "list" } })
          }
        />

        <POCategoryCard
          title="Quartz"
          description="Create new orders and manage quartz purchase orders."
          image={quartzImg}
          onAdd={() =>
            navigate("/purchase-orders/quartz", { state: { view: "form" } })
          }
          onList={() =>
            navigate("/purchase-orders/quartz", { state: { view: "list" } })
          }
        />

        <POCategoryCard
          title="Monuments"
          description="Create new orders and manage monument purchase orders."
          image={monumentsImg}
          onAdd={() =>
            navigate("/purchase-orders/monuments", { state: { view: "form" } })
          }
          onList={() =>
            navigate("/purchase-orders/monuments", { state: { view: "list" } })
          }
        />

      </div>
    </div>
  );
}
