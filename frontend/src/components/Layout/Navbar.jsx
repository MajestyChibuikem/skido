import React from 'react';
import { useLocation } from 'react-router-dom';
import { FaBars } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/upload':    'Upload Recording',
  '/history':   'Herd Health Reports',
  '/cattle':    'Cattle Records',
};

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function Navbar({ onMobileToggle }) {
  const { user } = useAuth();
  const location = useLocation();

  const title = Object.entries(PAGE_TITLES).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1] ?? 'AgroCare';

  return (
    <nav className="navbar">
      {/* Mobile hamburger */}
      <button
        className="navbar-mobile-toggle"
        onClick={onMobileToggle}
        aria-label="Toggle menu"
      >
        <FaBars />
      </button>

      <span className="navbar-page-title">{title}</span>

      <div className="navbar-divider" />

      {user?.name && (
        <div className="navbar-user-pill">
          <div className="navbar-avatar">{initials(user.name)}</div>
          <span className="navbar-username">{user.name}</span>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
