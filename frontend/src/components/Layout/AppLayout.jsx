import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import './Layout.css';

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <>
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} />
      <main className={`main-content ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <Outlet />
      </main>
    </>
  );
}

export default AppLayout;
