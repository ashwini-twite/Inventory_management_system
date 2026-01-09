import React, { createContext, useContext, useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import '../styles/layout.css';

const NavContext = createContext();

export const useNav = () => useContext(NavContext);

export default function Layout({ children }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

  const expandSidebar = () => {
    setIsSidebarCollapsed(false);
  };

  return (
    <NavContext.Provider value={{ isSidebarCollapsed, toggleSidebar, expandSidebar }}>
      <div className={`app-shell ${isSidebarCollapsed ? 'sidebar-hidden' : ''}`}>
        <Sidebar />
        <div className="app-main">
          <Topbar />
          <main className="app-content">{children}</main>
        </div>
      </div>
    </NavContext.Provider>
  );
}
