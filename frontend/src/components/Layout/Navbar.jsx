import React from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { FaBars, FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

function Navbar({ onToggleSidebar }) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <button className="navbar-toggle" onClick={onToggleSidebar} title="Toggle sidebar">
          <FaBars />
        </button>
        <Link to="/dashboard" className="navbar-brand">AgroCare</Link>
        <span className="navbar-subtitle">Cattle Lameness Detection</span>
      </div>

      <div className="navbar-right">
        {user?.name && (
          <span className="navbar-user">{user.name}</span>
        )}
        <button className="navbar-logout" onClick={handleLogout}>
          <FaSignOutAlt />
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
