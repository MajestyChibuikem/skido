import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  FaHome, FaUpload, FaHistory, FaChevronLeft, FaChevronRight, FaSignOutAlt,
} from 'react-icons/fa';
import { FaCow } from 'react-icons/fa6';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

const navItems = [
  { to: '/dashboard', icon: FaHome,    label: 'Dashboard',        end: true },
  { to: '/upload',    icon: FaUpload,  label: 'Upload Recording' },
  { to: '/history',   icon: FaHistory, label: 'Reports'          },
  { to: '/cattle',    icon: FaCow,     label: 'Cattle Records'   },
];

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function Sidebar({ collapsed, onToggle, mobileOpen }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const cls = [
    'sidebar',
    collapsed ? 'collapsed' : '',
    mobileOpen ? 'mobile-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <aside className={cls}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">AC</div>
        {!collapsed && (
          <div>
            <div className="sidebar-logo-text">AgroCare</div>
            <div className="sidebar-logo-sub">Lameness Detection</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {!collapsed && <div className="sidebar-nav-section">Navigation</div>}
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <Icon />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      {!collapsed && (
        <div style={{
          padding: '0.75rem 0.6rem',
          borderTop: '1px solid var(--border-sub)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.5rem 0.55rem',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-sub)',
          }}>
            <div style={{
              width: 30, height: 30,
              borderRadius: '50%',
              background: 'var(--teal-dim)',
              border: '1px solid rgba(101,228,207,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.7rem', fontWeight: 800, color: 'var(--teal)',
              flexShrink: 0,
            }}>
              {initials(user?.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-pri)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name || 'User'}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="navbar-logout" style={{ width: '100%', justifyContent: 'center' }}>
            <FaSignOutAlt /> Sign out
          </button>
        </div>
      )}

      {/* Collapse toggle */}
      <button className="sidebar-collapse-btn" onClick={onToggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {collapsed ? <FaChevronRight size={12} /> : <FaChevronLeft size={12} />}
      </button>
    </aside>
  );
}

export default Sidebar;
