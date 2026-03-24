import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cattleAPI, videoAPI } from '../../api/client';
import { FaUpload } from 'react-icons/fa';
import './Video.css';

function VideoUpload() {
  const navigate = useNavigate();
  const [cattle, setCattle] = useState([]);
  const [selectedCattle, setSelectedCattle] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    cattleAPI
      .list()
      .then((res) => setCattle(res.data))
      .catch((err) => console.error('Failed to load cattle:', err));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!selectedCattle) {
      setError('Please select a cattle record');
      return;
    }
    if (!file) {
      setError('Please select a video file');
      return;
    }

    const formData = new FormData();
    formData.append('video', file);
    formData.append('cattle_id', selectedCattle);

    setUploading(true);
    videoAPI
      .upload(formData, {
        onUploadProgress: (e) => {
          setProgress(Math.round((e.loaded * 100) / e.total));
        },
      })
      .then(() => navigate('/history'))
      .catch((err) => setError(err.response?.data?.error || 'Upload failed'))
      .finally(() => setUploading(false));
  };

  return (
    <div className="video-upload">
      <h1>Upload Video</h1>
      <form onSubmit={handleSubmit} className="upload-form">
        {error && <div className="form-error">{error}</div>}

        <div className="form-group">
          <label htmlFor="cattle">Select Cattle *</label>
          <select
            id="cattle"
            value={selectedCattle}
            onChange={(e) => setSelectedCattle(e.target.value)}
          >
            <option value="">-- Select Cattle --</option>
            {cattle.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.tag ? `(#${c.tag})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="video">Video File *</label>
          <div className="file-input-wrapper">
            <input
              type="file"
              id="video"
              accept="video/*"
              onChange={(e) => setFile(e.target.files[0])}
            />
            {file && <p className="file-name">{file.name}</p>}
          </div>
        </div>

        {uploading && (
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
            <span>{progress}%</span>
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={uploading}>
          <FaUpload /> {uploading ? 'Uploading...' : 'Upload Video'}
        </button>
      </form>
    </div>
  );
}

export default VideoUpload;
