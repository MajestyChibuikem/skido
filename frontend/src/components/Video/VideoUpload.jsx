import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { recordingsAPI } from '../../api/client';
import { FaCloudUploadAlt, FaFileVideo, FaInfoCircle, FaShieldAlt } from 'react-icons/fa';
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
      <div className="upload-header">
        <h1>Upload Herd Recording</h1>
        <p>
          Submit your herd footage to detect lameness risk. The system tracks up to 3 cows,
          marks affected cows in snapshots, and returns treatment guidance.
        </p>
      </div>

      <div className="upload-helper-grid">
        <div className="upload-helper-card">
          <FaFileVideo />
          <div>
            <strong>Best Input</strong>
            <p>Use clear side-view walking footage for more accurate gait scoring.</p>
          </div>
        </div>
        <div className="upload-helper-card">
          <FaShieldAlt />
          <div>
            <strong>What You Get</strong>
            <p>Per-cow lameness score, red-highlighted snapshot, and recommendations.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="upload-form">
        {error && <div className="form-error">{error}</div>}

        <div className="form-group">
          <label htmlFor="video">
            <FaInfoCircle /> Video File *
          </label>
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
          <FaCloudUploadAlt /> {uploading ? 'Uploading...' : 'Upload Recording'}
        </button>
      </form>
    </div>
  );
}

export default VideoUpload;
