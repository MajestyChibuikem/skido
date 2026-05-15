import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { recordingsAPI } from '../../api/client';
import { FaUpload } from 'react-icons/fa';
import './Video.css';

function VideoUpload() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!file) {
      setError('Please select a video file');
      return;
    }

    const formData = new FormData();
    formData.append('video', file);

    setUploading(true);
    recordingsAPI
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
      <h1>Upload Herd Recording</h1>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '1.5rem' }}>
        Upload a 1–2 hour farm recording. The AI will scan for up to 3 animals and
        flag any suspected lameness automatically.
      </p>

      <form onSubmit={handleSubmit} className="upload-form">
        {error && <div className="form-error">{error}</div>}

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
          <FaUpload /> {uploading ? 'Uploading...' : 'Upload Recording'}
        </button>
      </form>
    </div>
  );
}

export default VideoUpload;
