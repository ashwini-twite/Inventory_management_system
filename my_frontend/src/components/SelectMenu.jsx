import React, { useEffect, useMemo, useRef, useState } from "react";
import "../styles/selectMenu.css";

export default function SelectMenu({
  value,
  onChange,
  options,
  placeholder = "Select",
  className = "",
  disabled = false,
  ariaLabel = "Select option",
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const normalizedValue = value === null || value === undefined ? "" : String(value);
  const normalizedOptions = useMemo(
    () =>
      (options || []).map((option) =>
        typeof option === "string"
          ? { label: option, value: option }
          : { label: option.label, value: option.value }
      ),
    [options]
  );

  const selected = normalizedOptions.find(
    (option) => String(option.value) === normalizedValue
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!wrapperRef.current || wrapperRef.current.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOpen = () => {
    if (!disabled) setOpen((prev) => !prev);
  };

  const handleSelect = (nextValue) => {
    onChange?.(nextValue);
    setOpen(false);
  };

  return (
    <div
      className={`select-menu ${open ? "is-open" : ""} ${disabled ? "is-disabled" : ""} ${className}`}
      ref={wrapperRef}
    >
      <button
        type="button"
        className="select-menu__trigger"
        onClick={toggleOpen}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if ((event.key === "Enter" || event.key === " ") && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className={`select-menu__value ${selected ? "" : "is-placeholder"}`}>
          {selected ? selected.label : placeholder}
        </span>
      </button>

      {open && (
        <div className="select-menu__panel" role="listbox">
          {normalizedOptions.map((option) => {
            const isActive = String(option.value) === normalizedValue;
            return (
              <button
                key={String(option.value)}
                type="button"
                className={`select-menu__option ${isActive ? "is-active" : ""}`}
                onClick={() => handleSelect(option.value)}
                role="option"
                aria-selected={isActive}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
