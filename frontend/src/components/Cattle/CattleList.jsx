import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cattleAPI } from '../../api/client';
import { FaPlus, FaTrash } from 'react-icons/fa';
import './Cattle.css';

function CattleList() {
  const [cattle, setCattle] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCattle();
  }, []);

  const loadCattle = () => {
    cattleAPI
      .list()
      .then((res) => setCattle(res.data))
      .catch((err) => console.error('Failed to load cattle:', err))
      .finally(() => setLoading(false));
  };

  const handleDelete = (id) => {
    if (!window.confirm('Are you sure you want to delete this cattle record?')) return;
    cattleAPI
      .delete(id)
      .then(() => loadCattle())
      .catch((err) => console.error('Failed to delete:', err));
  };

  if (loading) return <div className="loading">Loading cattle records...</div>;

  return (
    <div className="cattle-list">
      <div className="list-header">
        <h1>Cattle Records</h1>
        <Link to="/cattle/new" className="btn btn-primary">
          <FaPlus /> Add Cattle
        </Link>
      </div>

      {cattle.length === 0 ? (
        <div className="empty-state">
          <p>No cattle records yet. Add your first cattle to get started.</p>
        </div>
      ) : (
        <div className="cattle-grid">
          {cattle.map((c) => (
            <div key={c.id} className="cattle-card">
              <div className="cattle-card-header">
                <h3>{c.name}</h3>
                {c.tag && <span className="tag">#{c.tag}</span>}
              </div>
              {c.breed && <p className="breed">{c.breed}</p>}
              <p className="video-count">{c.video_count} video(s)</p>
              <div className="cattle-card-actions">
                <Link to={`/cattle/${c.id}`} className="btn btn-sm">
                  View
                </Link>
                <button onClick={() => handleDelete(c.id)} className="btn btn-sm btn-danger">
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CattleList;
