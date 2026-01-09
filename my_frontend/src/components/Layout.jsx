import React from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import '../styles/layout.css';
import { NavProvider, useNav } from '../context/NavContext';

export default function Layout({ children }) {
  return (
    <NavProvider>
      <div className="layout-content-wrapper">
        <LayoutContent>{children}</LayoutContent>
      </div>
    </NavProvider>
  );
}

function LayoutContent({ children }) {
  const { isSidebarCollapsed } = useNav();
  return (
    <div className={`app-shell ${isSidebarCollapsed ? "sidebar-hidden" : ""}`}>
      <Sidebar />
      <div className="app-main">
        <Topbar />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
