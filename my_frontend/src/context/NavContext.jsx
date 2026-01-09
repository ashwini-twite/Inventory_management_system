import React, { createContext, useContext, useState } from 'react';

const NavContext = createContext();

export const useNav = () => {
    const context = useContext(NavContext);
    if (!context) {
        throw new Error('useNav must be used within a NavProvider');
    }
    return context;
};

export const NavProvider = ({ children }) => {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const toggleSidebar = () => {
        setIsSidebarCollapsed(prev => !prev);
    };

    const expandSidebar = () => {
        setIsSidebarCollapsed(false);
    };

    return (
        <NavContext.Provider value={{ isSidebarCollapsed, toggleSidebar, expandSidebar }}>
            {children}
        </NavContext.Provider>
    );
};
