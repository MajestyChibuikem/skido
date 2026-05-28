import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaHome, FaUpload, FaHistory } from 'react-icons/fa';
import { FaCow } from 'react-icons/fa6';
import './Layout.css';

const navItems = [
  { to: '/dashboard', icon: FaHome,    label: 'Dashboard',         end: true },
  { to: '/upload',    icon: FaUpload,  label: 'Upload Recording' },
  { to: '/history',   icon: FaHistory, label: 'Reports' },
  { to: '/cattle',    icon: FaCow,     label: 'Cattle Records' },
];

function Sidebar({ isOpen }) {
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <nav className="sidebar-nav">
        <div className="sidebar-nav-section">Navigation</div>
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
