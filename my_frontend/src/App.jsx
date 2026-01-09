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

const ProtectedRoute = ({ children }) => {
  const token = sessionStorage.getItem("token");
  if (token !== "admin-logged-in") {
    return <Navigate to="/login" replace />;
  }
  return children;
};

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
          <ProtectedRoute>
            <Layout>
              <Home />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* MANAGE STOCK */}
      <Route
        path="/manage-stock"
        element={
          <ProtectedRoute>
            <Layout>
              <ManageStock />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/manage-stock/products"
        element={
          <ProtectedRoute>
            <Layout>
              <ManageStockProducts />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/manage-stock/counts"
        element={
          <ProtectedRoute>
            <Layout>
              <ManageStockCounts />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/manage-stock/reserved"
        element={
          <ProtectedRoute>
            <Layout>
              <ReservedStocks />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* PURCHASE ORDERS */}
      <Route
        path="/purchase-orders"
        element={
          <ProtectedRoute>
            <Layout>
              <PurchaseOrders />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/purchase-orders/:catName"
        element={
          <ProtectedRoute>
            <Layout>
              <CategoryInputForm />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* CLIENT DETAILS */}
      <Route
        path="/clients"
        element={
          <ProtectedRoute>
            <Layout>
              <ClientDetails />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* REPORTS */}
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Layout>
              <Reports />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* LOGISTICS (SCAN + DELIVERY LIST + RETURNS) */}
      <Route
        path="/logistics/scan"
        element={
          <ProtectedRoute>
            <Layout>
              <Deliverystockscanpage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/logistics/list"
        element={
          <ProtectedRoute>
            <Layout>
              <Deliverylist />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/logistics/returns"
        element={
          <ProtectedRoute>
            <Layout>
              <ReturnsPage />   {/* Placeholder page */}
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  );
}
