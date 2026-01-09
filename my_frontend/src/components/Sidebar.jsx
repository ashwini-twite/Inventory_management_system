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
import { useNav } from "../context/NavContext";

export default function Sidebar() {
  const { isSidebarCollapsed, toggleSidebar, expandSidebar } = useNav();

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

  const closeOnMobile = () => {
    if (window.innerWidth <= 768) toggleSidebar();
  };

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    navigate("/login");
    // closeOnMobile logic can be handled by toggleSidebar if we want to force collapse on logout
  };

  return (
    <aside className={`sidebar ${!isSidebarCollapsed ? "sidebar-open" : "sidebar-collapsed"}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="sidebar-brand-accent" aria-hidden="true" />
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-light">Asian</span>
            <span className="sidebar-logo-strong">Granites</span>
          </div>
        </div>

        <button
          className="sidebar-toggle-btn"
          onClick={toggleSidebar}
          aria-label="Close Sidebar"
        >
          <Menu size={20} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/"
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
          onClick={() => {
            closeOnMobile();
            expandSidebar();
          }}
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
              expandSidebar();
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
            className={`sidebar-submenu-animated ${purchaseOpen ? "submenu-open" : "submenu-closed"
              }`}
          >
            <NavLink
              to="/purchase-orders/monuments"
              className={({ isActive }) =>
                "sidebar-sublink" + (isActive ? " sidebar-sublink-active" : "")
              }
              onClick={() => {
                closeOnMobile();
                expandSidebar();
              }}
            >
              - Monuments
            </NavLink>

            <NavLink
              to="/purchase-orders/granite"
              className={({ isActive }) =>
                "sidebar-sublink" + (isActive ? " sidebar-sublink-active" : "")
              }
              onClick={() => {
                closeOnMobile();
                expandSidebar();
              }}
            >
              - Granite
            </NavLink>

            <NavLink
              to="/purchase-orders/quartz"
              className={({ isActive }) =>
                "sidebar-sublink" + (isActive ? " sidebar-sublink-active" : "")
              }
              onClick={() => {
                closeOnMobile();
                expandSidebar();
              }}
            >
              - Quartz
            </NavLink>
          </div>
        </div>

        <NavLink
          to="/clients"
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
          onClick={() => {
            closeOnMobile();
            expandSidebar();
          }}
        >
          <Users size={18} className="sidebar-icon" />
          <span>Client Details</span>
        </NavLink>

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
              expandSidebar();
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
            className={`sidebar-submenu-animated ${stockOpen ? "submenu-open" : "submenu-closed"
              }`}
          >
            <NavLink
              to="/manage-stock/products"
              className={({ isActive }) =>
                "sidebar-sublink" + (isActive ? " sidebar-sublink-active" : "")
              }
              onClick={() => {
                closeOnMobile();
                expandSidebar();
              }}
            >
              - Products
            </NavLink>

            <NavLink
              to="/manage-stock/counts"
              className={({ isActive }) =>
                "sidebar-sublink" + (isActive ? " sidebar-sublink-active" : "")
              }
              onClick={() => {
                closeOnMobile();
                expandSidebar();
              }}
            >
              - Stock Counts
            </NavLink>

            <NavLink
              to="/manage-stock/reserved"
              className={({ isActive }) =>
                "sidebar-sublink" + (isActive ? " sidebar-sublink-active" : "")
              }
              onClick={() => {
                closeOnMobile();
                expandSidebar();
              }}
            >
              - Dispatch Stocks
            </NavLink>
          </div>
        </div>

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
              expandSidebar();
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
            className={`sidebar-submenu-animated ${logisticsOpen ? "submenu-open" : "submenu-closed"
              }`}
          >
            <NavLink
              to="/logistics/scan"
              className={({ isActive }) =>
                "sidebar-sublink" + (isActive ? " sidebar-sublink-active" : "")
              }
              onClick={() => {
                closeOnMobile();
                expandSidebar();
              }}
            >
              - Scan Page
            </NavLink>

            <NavLink
              to="/logistics/list"
              className={({ isActive }) =>
                "sidebar-sublink" + (isActive ? " sidebar-sublink-active" : "")
              }
              onClick={() => {
                closeOnMobile();
                expandSidebar();
              }}
            >
              - Delivery List
            </NavLink>

            <NavLink
              to="/logistics/returns"
              className={({ isActive }) =>
                "sidebar-sublink" + (isActive ? " sidebar-sublink-active" : "")
              }
              onClick={() => {
                closeOnMobile();
                expandSidebar();
              }}
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
          onClick={() => {
            closeOnMobile();
            expandSidebar();
          }}
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
