import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, Menu, ChevronDown, FileText, Boxes, Users, Truck, BarChart3, Home as HomeIcon } from "lucide-react";
import "../styles/topbar.css";
import { useNav } from "../context/NavContext";

const HorizontalNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { expandSidebar } = useNav();
  const [activeDropdown, setActiveDropdown] = useState(null);

  const handleNav = (path) => {
    navigate(path);
    expandSidebar(); // Restore sidebar on navigation via horizontal menu
    setActiveDropdown(null);
  };

  const toggleDropdown = (name, e) => {
    e.stopPropagation();
    setActiveDropdown(prev => prev === name ? null : name);
  };

  useEffect(() => {
    const closeDropdowns = () => setActiveDropdown(null);
    window.addEventListener('click', closeDropdowns);
    return () => window.removeEventListener('click', closeDropdowns);
  }, []);

  const isActive = (path) => location.pathname === path;
  const isDropdownActive = (prefix) => location.pathname.startsWith(prefix);

  return (
    <nav className="horizontal-nav">
      <button
        className={`hnav-item ${isActive("/") ? "is-active" : ""}`}
        onClick={() => handleNav("/")}
      >
        <HomeIcon size={16} /> Home
      </button>

      <div className={`hnav-dropdown ${isDropdownActive("/purchase-orders") ? "is-active" : ""} ${activeDropdown === 'purchase' ? 'is-open' : ''}`}>
        <button
          className="hnav-item"
          onClick={(e) => toggleDropdown('purchase', e)}
        >
          <FileText size={16} /> Purchase Orders <ChevronDown size={14} />
        </button>
        <div className="hnav-dropdown-content">
          <button onClick={() => handleNav("/purchase-orders/monuments")}>Monuments</button>
          <button onClick={() => handleNav("/purchase-orders/granite")}>Granite</button>
          <button onClick={() => handleNav("/purchase-orders/quartz")}>Quartz</button>
        </div>
      </div>

      <button
        className={`hnav-item ${isActive("/clients") ? "is-active" : ""}`}
        onClick={() => handleNav("/clients")}
      >
        <Users size={16} /> Clients
      </button>

      <div className={`hnav-dropdown ${isDropdownActive("/manage-stock") ? "is-active" : ""} ${activeDropdown === 'stock' ? 'is-open' : ''}`}>
        <button
          className="hnav-item"
          onClick={(e) => toggleDropdown('stock', e)}
        >
          <Boxes size={16} /> Manage Stock <ChevronDown size={14} />
        </button>
        <div className="hnav-dropdown-content">
          <button onClick={() => handleNav("/manage-stock/products")}>Products</button>
          <button onClick={() => handleNav("/manage-stock/counts")}>Stock Counts</button>
          <button onClick={() => handleNav("/manage-stock/reserved")}>Dispatch Stocks</button>
        </div>
      </div>

      <div className={`hnav-dropdown ${isDropdownActive("/logistics") ? "is-active" : ""} ${activeDropdown === 'logistics' ? 'is-open' : ''}`}>
        <button
          className="hnav-item"
          onClick={(e) => toggleDropdown('logistics', e)}
        >
          <Truck size={16} /> Logistics <ChevronDown size={14} />
        </button>
        <div className="hnav-dropdown-content">
          <button onClick={() => handleNav("/logistics/scan")}>Scan</button>
          <button onClick={() => handleNav("/logistics/list")}>Delivery List</button>
          <button onClick={() => handleNav("/logistics/returns")}>Returns</button>
        </div>
      </div>

      <button
        className={`hnav-item ${isActive("/reports") ? "is-active" : ""}`}
        onClick={() => handleNav("/reports")}
      >
        <BarChart3 size={16} /> Reports
      </button>
    </nav>
  );
};

export default function Topbar() {
  const [showPopup, setShowPopup] = useState(false);
  const [profileImg, setProfileImg] = useState(null);
  const [tempImgPreview, setTempImgPreview] = useState(null);
  const [now, setNow] = useState(new Date());
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleSidebar, isSidebarCollapsed } = useNav();

  // Load saved image from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("profileImage");
    if (saved) {
      setProfileImg(saved);
      setTempImgPreview(saved);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const pageTitle = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/manage-stock/reserved")) return "Reserved Stocks";
    if (path.startsWith("/manage-stock/counts")) return "Stock Counts";
    if (path.startsWith("/manage-stock/products")) return "Manage Stock";
    if (path.startsWith("/manage-stock")) return "Manage Stock";
    if (path.startsWith("/purchase-orders")) return "Purchase Orders";
    if (path.startsWith("/clients")) return "Client Details";
    if (path.startsWith("/reports")) return "Reports";
    if (path.startsWith("/logistics/scan")) return "Stock Scan";
    if (path.startsWith("/logistics/list")) return "Delivery List";
    if (path.startsWith("/logistics/returns")) return "Returns";
    return "Dashboard";
  }, [location.pathname]);

  const timeFull = useMemo(() => {
    const datePart = new Intl.DateTimeFormat("en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(now);
    const timePart = new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    }).format(now);
    return `${datePart} \u2022 ${timePart}`;
  }, [now]);

  const timeShort = useMemo(() => {
    const datePart = new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
    }).format(now);
    const timePart = new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    }).format(now);
    return `${datePart} \u2022 ${timePart}`;
  }, [now]);

  // Handle file selection (preview only)
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setTempImgPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveImage = () => {
    setProfileImg(tempImgPreview);
    localStorage.setItem("profileImage", tempImgPreview || "");
    setShowPopup(false);
  };

  const handleDeleteImage = () => {
    setProfileImg(null);
    setTempImgPreview(null);
    localStorage.removeItem("profileImage");
    setShowPopup(false);
  };

  const closePopup = () => {
    setShowPopup(false);
    setTempImgPreview(profileImg); // Reset preview to current saved image
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="topbar-icon hamburger-menu"
            onClick={toggleSidebar}
            aria-label="Toggle Sidebar"
          >
            <Menu size={20} />
          </button>
          <button
            type="button"
            className="topbar-title topbar-home-button"
            onClick={() => navigate("/")}
          >
            {pageTitle}
          </button>
        </div>

        {isSidebarCollapsed && <HorizontalNav />}

        <div className="topbar-right">
          <div className="topbar-time">
            <span className="time-full">{timeFull}</span>
            <span className="time-short">{timeShort}</span>
          </div>
          <button className="topbar-icon" type="button" aria-label="Notifications">
            <Bell size={18} />
          </button>
          <span className="topbar-user-name">Admin</span>

          <div
            className="topbar-avatar"
            onClick={() => setShowPopup(true)}
            style={{
              backgroundImage: profileImg ? `url(${profileImg})` : `url('https://ui-avatars.com/api/?name=Admin&background=2f5bd6&color=fff')`,
              backgroundSize: "cover",
            }}
          ></div>
        </div>
      </header>

      {/* MODAL POPUP */}
      {showPopup && (
        <div className="profile-popup-overlay" onClick={closePopup}>
          <div className="profile-popup" onClick={(e) => e.stopPropagation()}>
            <h3>Manage Profile Photo</h3>

            <div className="profile-preview-wrapper">
              <div
                className="profile-preview-img"
                style={{
                  backgroundImage: tempImgPreview ? `url(${tempImgPreview})` : `url('https://ui-avatars.com/api/?name=Admin&background=2f5bd6&color=fff')`,
                  backgroundSize: "cover",
                }}
              />
            </div>

            <div className="profile-actions-stack">
              <label className="upload-btn">
                {tempImgPreview ? "Change Photo" : "Choose Photo"}
                <input type="file" accept="image/*" onChange={handleImageSelect} />
              </label>

              {tempImgPreview && (
                <button className="save-btn" onClick={handleSaveImage}>
                  Save Changes
                </button>
              )}

              {profileImg && (
                <button className="delete-btn" onClick={handleDeleteImage}>
                  Delete Photo
                </button>
              )}

              <button className="close-btn" onClick={closePopup}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
