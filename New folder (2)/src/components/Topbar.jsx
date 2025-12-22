import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/topbar.css";

export default function Topbar() {
  const [showPopup, setShowPopup] = useState(false);
  const [profileImg, setProfileImg] = useState(null);
  const navigate = useNavigate();

  // Load saved image from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("profileImage");
    if (saved) setProfileImg(saved);
  }, []);

  // Handle file upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setProfileImg(reader.result);
      localStorage.setItem("profileImage", reader.result);
      setShowPopup(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <header className="topbar">
        <button
          type="button"
          className="topbar-title topbar-home-button"
          onClick={() => navigate("/")}
        >
          Home
        </button>

        <div className="topbar-right">
          <span className="topbar-user-name">Admin</span>

          <div
            className="topbar-avatar"
            onClick={() => setShowPopup(true)}
            style={{
              backgroundImage: profileImg ? `url(${profileImg})` : "none",
              backgroundSize: "cover",
            }}
          ></div>
        </div>
      </header>

      {/* MODAL POPUP */}
      {showPopup && (
        <div className="profile-popup-overlay" onClick={() => setShowPopup(false)}>
          <div className="profile-popup" onClick={(e) => e.stopPropagation()}>
            <h3>Upload Profile Photo</h3>

            <label className="upload-btn">
              Choose Photo
              <input type="file" accept="image/*" onChange={handleImageUpload} />
            </label>

            <button className="close-btn" onClick={() => setShowPopup(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
