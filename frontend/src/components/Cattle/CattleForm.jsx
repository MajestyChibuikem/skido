import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cattleAPI } from '../../api/client';
import './Cattle.css';

function CattleForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    tag: '',
    breed: '',
    notes: '',
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }

    cattleAPI
      .create(form)
      .then(() => navigate('/cattle'))
      .catch((err) => setError(err.response?.data?.error || 'Failed to add cattle'));
  };

  return (
    <div className="cattle-form-page">
      <h1>Add New Cattle</h1>
      <form onSubmit={handleSubmit} className="cattle-form">
        {error && <div className="form-error">{error}</div>}

        <div className="form-group">
          <label htmlFor="name">Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="e.g. Daisy"
          />
        </div>

        <div className="form-group">
          <label htmlFor="tag">Tag Number</label>
          <input
            type="text"
            id="tag"
            name="tag"
            value={form.tag}
            onChange={handleChange}
            placeholder="e.g. 001"
          />
        </div>

        <div className="form-group">
          <label htmlFor="breed">Breed</label>
          <input
            type="text"
            id="breed"
            name="breed"
            value={form.breed}
            onChange={handleChange}
            placeholder="e.g. Holstein"
          />
        </div>

        <div className="form-group">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows="3"
            placeholder="Any additional notes..."
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Add Cattle
          </button>
          <button type="button" className="btn" onClick={() => navigate('/cattle')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default CattleForm;
