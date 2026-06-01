import React from 'react';
import { useLocation } from 'react-router-dom';
import { FiMenu } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

const TITLES = {
  '/dashboard': 'Dashboard',
  '/upload':    'Upload Recording',
  '/history':   'Reports',
  '/cattle':    'Cattle Records',
};

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
}

export default function Navbar({ sidebarCollapsed, onMobileToggle }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const title = Object.entries(TITLES).find(([k]) => pathname.startsWith(k))?.[1] || 'AgroCare';

  return (
    <nav className={}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onMobileToggle}
          style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer',
                   color: 'var(--text-2)', fontSize: 18, padding: 4 }}
          className="mobile-menu-btn">
          <FiMenu />
        </button>
        <span className="navbar-page-title">{title}</span>
      </div>
      <div className="navbar-right">
        <div className="navbar-avatar" title={user?.name}>{initials(user?.name)}</div>
      </div>
    </nav>
  );
}
