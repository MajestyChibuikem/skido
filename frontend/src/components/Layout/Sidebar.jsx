import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaHome, FaUpload, FaHistory } from 'react-icons/fa';
import { FaCow } from 'react-icons/fa6';
import './Layout.css';

function Sidebar({ isOpen }) {
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className="sidebar-link" end>
          <FaHome /> <span>Dashboard</span>
        </NavLink>
        <NavLink to="/cattle" className="sidebar-link">
          <FaCow /> <span>Cattle</span>
        </NavLink>
        <NavLink to="/upload" className="sidebar-link">
          <FaUpload /> <span>Upload Video</span>
        </NavLink>
        <NavLink to="/history" className="sidebar-link">
          <FaHistory /> <span>History</span>
        </NavLink>
      </nav>
    </aside>
  );
}

export default Sidebar;
