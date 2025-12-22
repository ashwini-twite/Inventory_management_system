import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout";

// Home + Auth
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

// Manage Stock Pages
import ManageStock from "./pages/ManageStock";
import ManageStockProducts from "./pages/ManageStockProducts";
import ManageStockCounts from "./pages/ManageStockCounts";
import ReservedStocks from "./pages/ReservedStocks";

// Purchase Orders
import PurchaseOrders from "./pages/PurchaseOrders";
import CategoryInputForm from "./pages/CategoryInputForm";
import ClientDetails from "./pages/ClientDetails";
import Reports from "./pages/Reports";

// Logistics Pages (renamed from delivery-stock)
import Deliverystockscanpage from "./pages/Deliverystockscanpage";
import Deliverylist from "./pages/Deliverylist";
import ReturnsPage from "./pages/ReturnsPage";  // <-- create this file

export default function App() {
  return (
    <Routes>

      {/* AUTH */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* HOME */}
      <Route
        path="/"
        element={
          <Layout>
            <Home />
          </Layout>
        }
      />

      {/* MANAGE STOCK */}
      <Route
        path="/manage-stock"
        element={
          <Layout>
            <ManageStock />
          </Layout>
        }
      />

      <Route
        path="/manage-stock/products"
        element={
          <Layout>
            <ManageStockProducts />
          </Layout>
        }
      />

      <Route
        path="/manage-stock/counts"
        element={
          <Layout>
            <ManageStockCounts />
          </Layout>
        }
      />

      <Route
        path="/manage-stock/reserved"
        element={
          <Layout>
            <ReservedStocks />
          </Layout>
        }
      />

      {/* PURCHASE ORDERS */}
      <Route
        path="/purchase-orders"
        element={
          <Layout>
            <PurchaseOrders />
          </Layout>
        }
      />

      <Route
        path="/purchase-orders/:catName"
        element={
          <Layout>
            <CategoryInputForm />
          </Layout>
        }
      />

      {/* CLIENT DETAILS */}
      <Route
        path="/clients"
        element={
          <Layout>
            <ClientDetails />
          </Layout>
        }
      />

      {/* REPORTS */}
      <Route
        path="/reports"
        element={
          <Layout>
            <Reports />
          </Layout>
        }
      />

      {/* LOGISTICS (SCAN + DELIVERY LIST + RETURNS) */}
      <Route
        path="/logistics/scan"
        element={
          <Layout>
            <Deliverystockscanpage />
          </Layout>
        }
      />

      <Route
        path="/logistics/list"
        element={
          <Layout>
            <Deliverylist />
          </Layout>
        }
      />

      <Route
        path="/logistics/returns"
        element={
          <Layout>
            <ReturnsPage />   {/* Placeholder page */}
          </Layout>
        }
      />

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  );
}
