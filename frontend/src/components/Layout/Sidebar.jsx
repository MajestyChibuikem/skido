import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FiHome, FiUpload, FiList, FiLogOut, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

const NAV = [
  { to: '/dashboard', icon: FiHome,   label: 'Dashboard',        end: true },
  { to: '/upload',    icon: FiUpload, label: 'Upload Recording' },
  { to: '/history',   icon: FiList,   label: 'Reports' },
];

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
}

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => { await logout(); navigate('/login'); };

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">AC</div>
        <div className="sidebar-logo-text">
          <strong>AgroCare</strong>
          <span>Lameness Detection</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navigation</div>
        {NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            title={collapsed ? label : undefined}>
            <Icon /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <button className="sidebar-collapse-btn" onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'}>
        {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
      </button>
      <div className="sidebar-user">
        <div className="sidebar-user-inner">
          <div className="sidebar-user-avatar" title={user?.name}>{initials(user?.name)}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name || 'User'}</div>
            <div className="sidebar-user-email">{user?.email || ''}</div>
          </div>
          <button className="sidebar-signout-btn" onClick={handleLogout} title="Sign out">
            <FiLogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
