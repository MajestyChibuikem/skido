import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import './Layout.css';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <Navbar sidebarCollapsed={collapsed} />
      <main className={`main-content${collapsed ? ' sidebar-collapsed' : ''}`}>
        <Outlet />
      </main>
    </>
  );
}
