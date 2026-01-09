import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import "../styles/rowActionsMenu.css";

export default function RowActionsMenu({
  id,
  openId,
  setOpenId,
  actions = [],
  ariaLabel = "Row actions",
}) {
  const isOpen = openId === id;
  const wrapperRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (
        (wrapperRef.current && wrapperRef.current.contains(event.target)) ||
        (cardRef.current && cardRef.current.contains(event.target))
      ) {
        return;
      }
      setOpenId(null);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpenId(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, setOpenId]);

  const toggleMenu = () => {
    setOpenId(isOpen ? null : id);
  };

  return (
    <div className="row-actions" ref={wrapperRef}>
      <button
        type="button"
        className="row-actions__trigger"
        onClick={toggleMenu}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
      >
        <MoreVertical size={18} />
      </button>
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="row-actions__overlay"
            role="presentation"
            onClick={() => setOpenId(null)}
          >
            <div
              className="row-actions__card"
              role="dialog"
              aria-modal="true"
              aria-label={ariaLabel}
              onClick={(event) => event.stopPropagation()}
              ref={cardRef}
            >
              <div className="row-actions__card-title">Actions</div>
              <div className="row-actions__list" role="menu">
                {actions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="row-actions__item"
                    onClick={() => {
                      action.onClick?.();
                      setOpenId(null);
                    }}
                    disabled={action.disabled}
                    role="menuitem"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
