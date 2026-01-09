import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import POCategoryCard from "../components/POCategoryCard";

import graniteImg from "../assets/image.png";
import quartzImg from "../assets/download4.jfif";
import monumentsImg from "../assets/images2.jfif";

import "../styles/purchaseOrders.css";


export default function PurchaseOrders() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    granite: { total: 0, pending: 0, completed: 0 },
    quartz: { total: 0, pending: 0, completed: 0 },
    monuments: { total: 0, pending: 0, completed: 0 }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000"}/purchase_orders/stats`);
        if (!res.ok) throw new Error("Failed to fetch stats");
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error("Error fetching PO stats:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) return <div className="po-page"><p>Loading stats...</p></div>;

  return (
    <div className="po-page">

      {/* PAGE HEADER */}
      <div className="po-header">
        <div className="po-header-left">
          <h2 className="section-title">Purchase Orders</h2>
          <p className="section-subtitle">
            Create and manage purchase orders by category
          </p>
        </div>
      </div>

      {/* CORRECT GRID */}
      <div className="po-category-card-wrapper">

        <POCategoryCard
          title="Monuments"
          description="Create new orders and manage monument purchase orders."
          image={monumentsImg}
          metrics={stats.monuments}
          onAdd={() =>
            navigate("/purchase-orders/monuments", { state: { view: "form" } })
          }
          onList={() =>
            navigate("/purchase-orders/monuments", { state: { view: "list" } })
          }
        />

        <POCategoryCard
          title="Granite"
          description="Create new orders and manage existing granite purchase orders."
          image={graniteImg}
          metrics={stats.granite}
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
          metrics={stats.quartz}
          onAdd={() =>
            navigate("/purchase-orders/quartz", { state: { view: "form" } })
          }
          onList={() =>
            navigate("/purchase-orders/quartz", { state: { view: "list" } })
          }
        />

      </div>
    </div>
  );
}
