import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { recordingsAPI } from '../../api/client';
import {
  FaCloudUploadAlt,
  FaFileVideo,
  FaShieldAlt,
  FaCheckCircle,
  FaTimes,
  FaVideo,
  FaInfoCircle,
} from 'react-icons/fa';
import '../Cattle/Cattle.css';
import './Video.css';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function VideoUpload() {
  const navigate   = useNavigate();
  const inputRef   = useRef(null);
  const [file, setFile]         = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState('');
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const acceptFile = (f) => {
    if (!f) return;
    const ok = f.type.startsWith('video/') || /\.(mp4|avi|mov|mkv|webm)$/i.test(f.name);
    if (!ok) { setError('Please select a valid video file (MP4, AVI, MOV, MKV, WebM).'); return; }
    setError('');
    setFile(f);
  };

  const handleDragOver  = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = ()    => setDragOver(false);
  const handleDrop      = (e)   => {
    e.preventDefault();
    setDragOver(false);
    acceptFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!file) { setError('Please select a video file.'); return; }

    const formData = new FormData();
    formData.append('video', file);

    setUploading(true);
    recordingsAPI
      .upload(formData, {
        onUploadProgress: (ev) => setProgress(Math.round((ev.loaded * 100) / ev.total)),
      })
      .then(() => navigate('/history'))
      .catch((err) => setError(err.response?.data?.error || 'Upload failed. Please try again.'))
      .finally(() => setUploading(false));
  };

  return (
    <div className="video-upload">
      {/* Header */}
      <div className="upload-header">
        <h1>Upload Herd Recording</h1>
        <p>
          Submit herd footage to detect lameness. The AI tracks each cow, flags
          affected animals with a red bounding box, and provides per-cow treatment guidance.
        </p>
      </div>

      {/* Helper cards */}
      <div className="upload-helper-grid">
        <div className="upload-helper-card">
          <FaFileVideo />
          <div>
            <strong>Best Footage</strong>
            <p>Use clear side-view walking footage at normal speed for the most accurate gait scoring.</p>
          </div>
        </div>
        <div className="upload-helper-card">
          <FaShieldAlt />
          <div>
            <strong>What You Get</strong>
            <p>Per-cow lameness score, red-highlighted snapshot, and actionable veterinary recommendations.</p>
          </div>
        </div>
        <div className="upload-helper-card">
          <FaInfoCircle />
          <div>
            <strong>Supported Formats</strong>
            <p>MP4, AVI, MOV, MKV, WebM — up to the server's configured file-size limit.</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="upload-form">
        {error && (
          <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FaTimes style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        {/* Drop zone */}
        <div
          className={`drop-zone${dragOver ? ' drag-over' : ''}${file ? ' has-file' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*,.mp4,.avi,.mov,.mkv,.webm"
            onChange={(e) => acceptFile(e.target.files[0])}
            style={{ display: 'none' }}
          />

          {file ? (
            <div className="drop-zone-file">
              <FaVideo className="drop-zone-file-icon" />
              <div className="drop-zone-file-info">
                <div className="drop-zone-file-name">{file.name}</div>
                <div className="drop-zone-file-size">{formatBytes(file.size)}</div>
              </div>
              <button
                type="button"
                className="drop-zone-clear"
                onClick={(e) => { e.stopPropagation(); setFile(null); setError(''); }}
                title="Remove file"
              >
                <FaTimes />
              </button>
            </div>
          ) : (
            <div className="drop-zone-idle">
              <FaCloudUploadAlt className="drop-zone-icon" />
              <div className="drop-zone-label">
                {dragOver ? 'Drop video here' : 'Drag & drop a video here'}
              </div>
              <div className="drop-zone-sub">or click to browse files</div>
            </div>
          )}
        </div>

        {/* Upload progress */}
        {uploading && (
          <div className="upload-progress-wrap">
            <div className="upload-progress-header">
              <span>Uploading…</span>
              <span className="upload-progress-pct">{progress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            {progress === 100 && (
              <div className="upload-processing-note">
                <FaCheckCircle style={{ color: '#65E4CF' }} />
                Upload complete — analysis starting in the background.
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary upload-submit-btn"
          disabled={uploading || !file}
        >
          {uploading ? (
            <>Uploading {progress}%…</>
          ) : (
            <><FaCloudUploadAlt /> Analyse Recording</>
          )}
        </button>
      </form>
    </div>
  );
}

export default VideoUpload;
