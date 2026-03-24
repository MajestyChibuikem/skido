import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaBars, FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

function Navbar({ onToggleSidebar }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button className="navbar-toggle" onClick={onToggleSidebar}>
          <FaBars />
        </button>
        <Link to="/dashboard" className="navbar-brand">
          Skido
        </Link>
        <span className="navbar-subtitle">Cattle Lameness Detection</span>
      </div>
      <button
        onClick={handleLogout}
        style={{
          color: 'rgba(255,255,255,0.5)',
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          cursor: 'pointer',
          padding: '0.35rem 0.75rem',
          borderRadius: '8px',
          fontSize: '0.85rem',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => { e.target.style.color = '#65E4CF'; e.target.style.borderColor = 'rgba(101,228,207,0.3)'; }}
        onMouseLeave={(e) => { e.target.style.color = 'rgba(255,255,255,0.5)'; e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
      >
        <FaSignOutAlt /> Logout
      </button>
    </nav>
  );
}

export default Navbar;
