import React, { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  FileText,
  Boxes,
  Users,
  Truck,
  BarChart3,
  LogOut,
  Menu,
  ChevronDown,
} from "lucide-react";
import "../styles/sidebar.css";

export default function Sidebar() {
  const [open, setOpen] = useState(true);

  const [purchaseOpen, setPurchaseOpen] = useState(true);
  const [stockOpen, setStockOpen] = useState(true);
  const [logisticsOpen, setLogisticsOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname.startsWith("/purchase-orders")) {
      setPurchaseOpen(true);
    }
    if (location.pathname.startsWith("/manage-stock")) {
      setStockOpen(true);
    }
    if (location.pathname.startsWith("/logistics")) {
      setLogisticsOpen(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      setOpen(window.innerWidth > 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const closeOnMobile = () => {
    if (window.innerWidth <= 768) setOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
    closeOnMobile();
  };

  return (
    <aside className={`sidebar ${open ? "sidebar-open" : "sidebar-collapsed"}`}>
      <div className="sidebar-header">
        <button className="sidebar-toggle" onClick={() => setOpen(!open)}>
          <Menu size={20} color="#fff" />
        </button>
        <span className="sidebar-logo-text">Asian Granites</span>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/"
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
          onClick={closeOnMobile}
        >
          <Home size={18} className="sidebar-icon" />
          <span>Home</span>
        </NavLink>

        <div className="sidebar-group">
          <button
            className={
              "sidebar-link sidebar-parent" +
              (location.pathname.startsWith("/purchase-orders")
                ? " sidebar-link-active"
                : "")
            }
            onClick={() => {
              setPurchaseOpen(!purchaseOpen);
              navigate("/purchase-orders");
              closeOnMobile();
            }}
          >
            <FileText size={18} className="sidebar-icon" />
            <span>Purchase Orders</span>
            <ChevronDown
              size={16}
              className={`dropdown-arrow ${purchaseOpen ? "dropdown-rotate" : ""}`}
            />
          </button>

          <div
            className={`sidebar-submenu-animated ${
              purchaseOpen ? "submenu-open" : "submenu-closed"
            }`}
          >
            <NavLink
              to="/purchase-orders/monuments"
            className={({ isActive }) =>
              "sidebar-sublink" + (isActive ? " sidebar-sublink-active" : "")
            }
            onClick={closeOnMobile}
          >
              - Monuments
            </NavLink>

            <NavLink
              to="/purchase-orders/granite"
            className={({ isActive }) =>
              "sidebar-sublink" + (isActive ? " sidebar-sublink-active" : "")
            }
            onClick={closeOnMobile}
          >
              - Granite
            </NavLink>

            <NavLink
              to="/purchase-orders/quartz"
            className={({ isActive }) =>
              "sidebar-sublink" + (isActive ? " sidebar-sublink-active" : "")
            }
            onClick={closeOnMobile}
          >
              - Quartz
            </NavLink>
          </div>
        </div>

        <div className="sidebar-group">
          <button
            className={
              "sidebar-link sidebar-parent" +
              (location.pathname.startsWith("/manage-stock")
                ? " sidebar-link-active"
                : "")
            }
            onClick={() => {
              setStockOpen(!stockOpen);
              navigate("/manage-stock");
              closeOnMobile();
            }}
          >
            <Boxes size={18} className="sidebar-icon" />
            <span>Manage Stock</span>
            <ChevronDown
              size={16}
              className={`dropdown-arrow ${stockOpen ? "dropdown-rotate" : ""}`}
            />
          </button>

          <div
            className={`sidebar-submenu-animated ${
              stockOpen ? "submenu-open" : "submenu-closed"
            }`}
          >
            <NavLink
              to="/manage-stock/products"
            className={({ isActive }) =>
              "sidebar-sublink" + (isActive ? " sidebar-sublink-active" : "")
            }
            onClick={closeOnMobile}
          >
              - Products
            </NavLink>

            <NavLink
              to="/manage-stock/counts"
            className={({ isActive }) =>
              "sidebar-sublink" + (isActive ? " sidebar-sublink-active" : "")
            }
            onClick={closeOnMobile}
          >
              - Stock Counts
            </NavLink>

            <NavLink
              to="/manage-stock/reserved"
            className={({ isActive }) =>
              "sidebar-sublink" + (isActive ? " sidebar-sublink-active" : "")
            }
            onClick={closeOnMobile}
          >
              - Dispatch Stocks
            </NavLink>
          </div>
        </div>

        <NavLink
          to="/clients"
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
          onClick={closeOnMobile}
        >
          <Users size={18} className="sidebar-icon" />
          <span>Client Details</span>
        </NavLink>

        <div className="sidebar-group">
          <button
            className={
              "sidebar-link sidebar-parent" +
              (location.pathname.startsWith("/logistics")
                ? " sidebar-link-active"
                : "")
            }
            onClick={() => {
              setLogisticsOpen(!logisticsOpen);
              navigate("/logistics/scan");
              closeOnMobile();
            }}
          >
            <Truck size={18} className="sidebar-icon" />
            <span>Logistics</span>
            <ChevronDown
              size={16}
              className={`dropdown-arrow ${logisticsOpen ? "dropdown-rotate" : ""}`}
            />
          </button>

          <div
            className={`sidebar-submenu-animated ${
              logisticsOpen ? "submenu-open" : "submenu-closed"
            }`}
          >
            <NavLink
              to="/logistics/scan"
            className={({ isActive }) =>
              "sidebar-sublink" + (isActive ? " sidebar-sublink-active" : "")
            }
            onClick={closeOnMobile}
          >
              - Scan Page
            </NavLink>

            <NavLink
              to="/logistics/list"
            className={({ isActive }) =>
              "sidebar-sublink" + (isActive ? " sidebar-sublink-active" : "")
            }
            onClick={closeOnMobile}
          >
              - Delivery List
            </NavLink>

            <NavLink
              to="/logistics/returns"
            className={({ isActive }) =>
              "sidebar-sublink" + (isActive ? " sidebar-sublink-active" : "")
            }
            onClick={closeOnMobile}
          >
              - Returns
            </NavLink>
          </div>
        </div>

        <NavLink
          to="/reports"
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
          onClick={closeOnMobile}
        >
          <BarChart3 size={18} className="sidebar-icon" />
          <span>Reports</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={handleLogout}>
          <LogOut size={18} className="sidebar-icon" />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
