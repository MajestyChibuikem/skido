import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import './Layout.css';

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, []);

  return (
    <>
      <Navbar onMobileToggle={() => setMobileOpen(o => !o)} />
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        mobileOpen={mobileOpen}
      />
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 250,
            background: 'rgba(0,0,0,0.5)',
          }}
        />
      )}
      <main className={`main-content${collapsed ? ' collapsed' : ''}`}>
        <Outlet />
      </main>
    </>
  );
}

export default AppLayout;
