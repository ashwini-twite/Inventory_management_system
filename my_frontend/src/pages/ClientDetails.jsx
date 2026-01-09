import React, { useEffect, useState } from "react";
import "../styles/clients.css";
// import { supabase } from "../supabaseClient"; // REMOVED

const API_BASE = "http://127.0.0.1:8000";

const emptyClient = {
  Client_name: "",
  Contact: "",
  Email: "",
  Address_line: "",
  Address_location: "",
  Address_city: "",
  Address_state: "",
  Country: "",
  Postal_code: "",
  Vat_number: "",
};

export default function ClientDetails() {
  const [view, setView] = useState("list");
  const [clients, setClients] = useState([]);
  const [formData, setFormData] = useState(emptyClient);
  const [editingId, setEditingId] = useState(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchValue, setSearchValue] = useState("");

  // =============================
  // FETCH CLIENTS FROM API
  // =============================
  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    try {
      const res = await fetch(`${API_BASE}/clients/`);
      if (!res.ok) throw new Error("Failed to fetch clients");
      const data = await res.json();
      setClients(data);
    } catch (err) {
      console.error("Fetch clients error:", err);
    }
  }

  // =============================
  // HANDLE FORM INPUT
  // =============================
  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData(emptyClient);
    setEditingId(null);
  };

  // =============================
  // ADD / UPDATE CLIENT
  // =============================
  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      if (editingId) {
        // Update existing client
        const res = await fetch(`${API_BASE}/clients/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!res.ok) throw new Error("Update failed");
        alert("Client updated");
      } else {
        // Insert new client
        const res = await fetch(`${API_BASE}/clients/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!res.ok) throw new Error("Insert failed");
        alert("Client added");
      }

      resetForm();
      setView("list");
      fetchClients();
    } catch (err) {
      console.error("Submit error:", err);
      alert("Failed to save client: " + err.message);
    }
  };

  // =============================
  // SEARCH
  // =============================
  const handleSearch = (event) => {
    if (event) event.preventDefault();
    setSearchValue(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchValue("");
    setSearchInput("");
  };

  // =============================
  // EDIT EXISTING CLIENT
  // =============================
  const handleEdit = (client) => {
    setEditingId(client.Client_id);
    setFormData({ ...client });
    setView("form");
  };

  // =============================
  // DELETE CLIENT
  // =============================
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this client?")) return;

    try {
      const res = await fetch(`${API_BASE}/clients/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      fetchClients();
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete client");
    }
  };

  const handleCancel = () => {
    resetForm();
    setView("list");
  };

  const formTitle = editingId ? "Edit Client" : "Add New Client";

  const filteredClients = clients.filter((client) => {
    if (!searchValue.trim()) return true;

    const parts = searchValue.toLowerCase().split(/[ ,+]+/).filter(Boolean);
    const searchableText = [
      client.Client_name,
      client.Contact,
      client.Email,
      client.Address_location,
      client.Address_city,
      client.Address_state,
      client.Country,
      client.Postal_code,
      client.Vat_number,
    ].join(" ").toLowerCase();

    return parts.every(p => searchableText.includes(p));
  });

  return (
    <div className="client-page">
      <div className="client-header">
        <div>
          <h2 className="section-title">Client Details</h2>
          <p className="client-subtitle">
            Add new clients or switch to the list to manage existing records.
          </p>
        </div>

        <div className="client-actions">
          <button
            type="button"
            className={`client-btn ${view === "form" ? "primary" : ""}`}
            onClick={() => setView("form")}
          >
            Add New Client
          </button>

          <button
            type="button"
            className={`client-btn ${view === "list" ? "primary" : ""}`}
            onClick={() => setView("list")}
          >
            Client List
          </button>
        </div>
      </div>

      {/* FORM VIEW */}
      {view === "form" ? (
        <form className="client-card" onSubmit={handleSubmit}>
          <div className="client-card-header">
            <h3 className="client-card-title">{formTitle}</h3>
            <p className="client-card-subtitle">
              Fill in the client details below and submit.
            </p>
          </div>

          <div className="client-grid">
            <div className="client-field">
              <label>Client Name</label>
              <input
                name="Client_name"
                value={formData.Client_name}
                onChange={handleChange}
                required
                placeholder="Enter client name"
              />
            </div>

            <div className="client-field">
              <label>Contact</label>
              <input name="Contact" value={formData.Contact} onChange={handleChange} />
            </div>

            <div className="client-field">
              <label>Email</label>
              <input
                name="Email"
                type="email"
                value={formData.Email}
                onChange={handleChange}
              />
            </div>

            <div className="client-field">
              <label>Address Line</label>
              <input
                name="Address_line"
                value={formData.Address_line}
                onChange={handleChange}
              />
            </div>

            <div className="client-field">
              <label>Location</label>
              <input
                name="Address_location"
                value={formData.Address_location}
                onChange={handleChange}
              />
            </div>

            <div className="client-field">
              <label>City</label>
              <input
                name="Address_city"
                value={formData.Address_city}
                onChange={handleChange}
              />
            </div>

            <div className="client-field">
              <label>State</label>
              <input
                name="Address_state"
                value={formData.Address_state}
                onChange={handleChange}
              />
            </div>

            <div className="client-field">
              <label>Country</label>
              <input
                name="Country"
                value={formData.Country}
                onChange={handleChange}
              />
            </div>

            <div className="client-field">
              <label>Postal Code</label>
              <input
                name="Postal_code"
                value={formData.Postal_code}
                onChange={handleChange}
              />
            </div>

            <div className="client-field">
              <label>VAT Number</label>
              <input
                name="Vat_number"
                value={formData.Vat_number}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="client-actions-row">
            <button type="button" className="client-btn ghost" onClick={handleCancel}>
              Cancel
            </button>
            <button type="submit" className="client-btn primary">
              Save & Submit
            </button>
          </div>
        </form>
      ) : (
        <div className="client-card">
          <div className="client-card-header">
            <h3 className="client-card-title">Client List</h3>
            <p className="client-card-subtitle">
              View all clients and manage records.
            </p>

            <button className="client-btn primary" onClick={() => setView("form")}>
              + Add Client
            </button>
          </div>

          <div className="list-header-row-standard">
            <div className="list-filters-standard">
              <div className="search-box-wrapper-standard">
                <input
                  type="text"
                  className="search-input-standard"
                  placeholder="Search clients (name, contact, email...)"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                {searchInput && (
                  <button className="search-clear-btn-standard" onClick={handleClearSearch}>&times;</button>
                )}
              </div>
            </div>
          </div>

          <div className="client-table-wrapper excel-table-wrap">
            <table className="client-table excel-table">
              <colgroup>
                <col className="excel-col-lg" />
                <col className="excel-col-sm" />
                <col className="excel-col-lg" />
                <col className="excel-col-md" />
                <col className="excel-col-sm" />
                <col className="excel-col-sm" />
                <col className="excel-col-sm" />
                <col className="excel-col-sm excel-align-right" />
                <col className="excel-col-sm" />
                <col className="excel-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>Location</th>
                  <th>City</th>
                  <th>State</th>
                  <th>Country</th>
                  <th className="excel-align-right">Postal Code</th>
                  <th>VAT Number</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="client-empty">
                      No clients found.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => (
                    <tr key={client.Client_id}>
                      <td>{client.Client_name}</td>
                      <td>{client.Contact}</td>
                      <td>{client.Email}</td>
                      <td>{client.Address_location}</td>
                      <td>{client.Address_city}</td>
                      <td>{client.Address_state}</td>
                      <td>{client.Country}</td>
                      <td>{client.Postal_code}</td>
                      <td>{client.Vat_number}</td>
                      <td>
                        <div className="client-table-actions">
                          <button
                            className="client-btn small"
                            onClick={() => handleEdit(client)}
                          >
                            Edit
                          </button>
                          <button
                            className="client-btn danger"
                            onClick={() => handleDelete(client.Client_id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
