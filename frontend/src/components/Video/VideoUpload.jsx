import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { recordingsAPI } from '../../api/client';
import {
  FaCloudUploadAlt, FaVideo, FaTimes, FaCheckCircle,
  FaArrowRight, FaSearch, FaBrain, FaCamera,
} from 'react-icons/fa';
import './Video.css';

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const STEPS = [
  { icon: FaCloudUploadAlt, label: 'Upload',   desc: 'Sending video to server'  },
  { icon: FaSearch,         label: 'Detecting', desc: 'YOLOv8 tracking cattle'   },
  { icon: FaBrain,          label: 'Analysing', desc: 'Scoring gait patterns'    },
  { icon: FaCamera,         label: 'Snapshots', desc: 'Annotating detected cows' },
];

export default function VideoUpload() {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [file,       setFile]       = useState(null);
  const [dragOver,   setDragOver]   = useState(false);
  const [error,      setError]      = useState('');
  const [phase,      setPhase]      = useState('idle');  // idle | uploading | done
  const [progress,   setProgress]   = useState(0);
  const [stepIndex,  setStepIndex]  = useState(0);

  const acceptFile = f => {
    if (!f) return;
    const ok = f.type.startsWith('video/') || /\.(mp4|avi|mov|mkv|webm)$/i.test(f.name);
    if (!ok) { setError('Please select a valid video file (MP4, AVI, MOV, MKV, WebM).'); return; }
    setError('');
    setFile(f);
  };

  const handleDrop = e => {
    e.preventDefault(); setDragOver(false);
    acceptFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!file) { setError('Please select a video first.'); return; }
    setError('');
    setPhase('uploading');
    setStepIndex(0);

    const fd = new FormData();
    fd.append('video', file);

    try {
      await recordingsAPI.upload(fd, {
        onUploadProgress: ev => {
          const pct = Math.round((ev.loaded * 100) / ev.total);
          setProgress(pct);
          // Animate through steps as upload progresses
          if (pct >= 25) setStepIndex(1);
          if (pct >= 55) setStepIndex(2);
          if (pct >= 85) setStepIndex(3);
        },
      });
      setPhase('done');
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed — please try again.');
      setPhase('idle');
    }
  };

  /* ── Idle / select phase ── */
  if (phase === 'idle') return (
    <div className="upload-page">
      <div className="upload-head">
        <h1>Upload Herd Recording</h1>
        <p>
          Submit footage of your herd walking. The AI detects each animal, scores their gait,
          and highlights lameness cases with annotated bounding-box snapshots.
        </p>
      </div>

      {/* Tips row */}
      <div className="upload-tips">
        {[
          { icon: FaVideo,   title: 'Side-view footage',   body: 'Film cows walking in a line from the side for the most accurate gait reading.' },
          { icon: FaCamera,  title: 'What you receive',    body: 'Annotated snapshot per cow, lameness score (0-10), status label, and treatment advice.' },
          { icon: FaBrain,   title: 'Supported formats',   body: 'MP4, AVI, MOV, MKV, WebM — up to the server file-size limit.' },
        ].map(t => (
          <div key={t.title} className="upload-tip">
            <div className="upload-tip-icon"><t.icon /></div>
            <div>
              <strong>{t.title}</strong>
              <p>{t.body}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="upload-form">
        {error && (
          <div className="upload-error">
            <FaTimes /> {error}
          </div>
        )}

        {/* Drop zone */}
        <div
          className={`drop-zone${dragOver ? ' drag-over' : ''}${file ? ' has-file' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*,.mp4,.avi,.mov,.mkv,.webm"
            onChange={e => acceptFile(e.target.files[0])}
            style={{ display: 'none' }}
          />

          {file ? (
            <div className="dz-file">
              <FaVideo className="dz-file-icon" />
              <div className="dz-file-info">
                <div className="dz-file-name">{file.name}</div>
                <div className="dz-file-size">{fmt(file.size)}</div>
              </div>
              <button
                type="button"
                className="dz-clear"
                onClick={e => { e.stopPropagation(); setFile(null); setError(''); }}
                title="Remove"
              >
                <FaTimes />
              </button>
            </div>
          ) : (
            <div className="dz-idle">
              <FaCloudUploadAlt className="dz-icon" />
              <div className="dz-label">
                {dragOver ? 'Drop video here' : 'Drag & drop a video file'}
              </div>
              <div className="dz-sub">or click to browse — MP4, AVI, MOV, MKV, WebM</div>
            </div>
          )}
        </div>

        <button type="submit" className="btn btn-primary upload-btn" disabled={!file}>
          <FaCloudUploadAlt /> Analyse Recording
        </button>
      </form>
    </div>
  );

  /* ── Uploading phase ── */
  if (phase === 'uploading') return (
    <div className="upload-page">
      <div className="upload-head">
        <h1>Analysing Recording</h1>
        <p>Please wait — your video is being uploaded and processed.</p>
      </div>

      <div className="upload-wizard">
        {/* Step indicators */}
        <div className="wizard-steps">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const state = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'pending';
            return (
              <React.Fragment key={s.label}>
                <div className={`wizard-step ${state}`}>
                  <div className="wizard-step-circle">
                    {state === 'done' ? <FaCheckCircle /> : <Icon />}
                  </div>
                  <div className="wizard-step-label">{s.label}</div>
                  {state === 'active' && (
                    <div className="wizard-step-desc">{s.desc}</div>
                  )}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`wizard-connector${state === 'done' ? ' done' : ''}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="wizard-progress-wrap">
          <div className="wizard-progress-bar">
            <div className="wizard-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="wizard-progress-pct">{progress}%</div>
        </div>

        {progress === 100 && (
          <div className="wizard-complete-note">
            <FaCheckCircle style={{ color: 'var(--teal)' }} />
            Upload complete — AI analysis running in background.
          </div>
        )}
      </div>
    </div>
  );

  /* ── Done phase ── */
  return (
    <div className="upload-page">
      <div className="upload-wizard done-state">
        <div className="done-icon">
          <FaCheckCircle />
        </div>
        <h2>Recording Submitted</h2>
        <p>
          <strong>{file?.name}</strong> has been uploaded. The AI will detect animals,
          score gait patterns, and save annotated snapshots. Results appear in Reports.
        </p>
        <div className="done-actions">
          <button className="btn btn-primary" onClick={() => navigate('/history')}>
            View Reports <FaArrowRight />
          </button>
          <button className="btn btn-ghost" onClick={() => { setFile(null); setPhase('idle'); setProgress(0); setStepIndex(0); }}>
            Upload Another
          </button>
        </div>
      </div>
    </div>
  );
}
