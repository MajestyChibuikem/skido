import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { recordingsAPI } from '../../api/client';
import {
  FiUploadCloud, FiVideo, FiX, FiCheckCircle, FiArrowRight,
  FiZap, FiEye, FiBarChart2,
} from 'react-icons/fi';
import './Video.css';

const ease = [0.25, 0.1, 0.25, 1];

const AI_STEPS = [
  { icon: FiVideo,    label: 'Detecting cattle',     desc: 'YOLOv8 object detection' },
  { icon: FiEye,      label: 'Tracking movement',    desc: 'ByteTrack multi-animal' },
  { icon: FiBarChart2,label: 'Analysing gait',       desc: 'Lameness scoring' },
  { icon: FiZap,      label: 'Generating report',    desc: 'Annotating frames' },
];

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

/* ── Step 1: drop zone ── */
function StepDrop({ onFile }) {
  const ref  = useRef(null);
  const [drag, setDrag] = useState(false);
  const [err, setErr]   = useState('');

  const accept = f => {
    if (!f) return;
    const ok = f.type.startsWith('video/') || /\.(mp4|avi|mov|mkv|webm)$/i.test(f.name);
    if (!ok) { setErr('Please select a valid video file (MP4, AVI, MOV, MKV, WebM).'); return; }
    setErr(''); onFile(f);
  };

  return (
    <motion.div className="upload-step" initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.34,ease }}>
      <h1 className="upload-title">Upload Recording</h1>
      <p className="upload-sub">Upload herd footage to detect and score cattle lameness automatically.</p>

      <div
        className={`drop-zone${drag ? ' drag' : ''}`}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files[0]); }}
        onClick={() => ref.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && ref.current?.click()}
      >
        <input ref={ref} type="file" accept="video/*,.mp4,.avi,.mov,.mkv,.webm"
          onChange={e => accept(e.target.files[0])} style={{ display:'none' }} />
        <motion.div animate={{ scale: drag ? 1.08 : 1 }} transition={{ duration: 0.15 }}>
          <FiUploadCloud className="drop-icon" />
        </motion.div>
        <div className="drop-label">{drag ? 'Release to upload' : 'Drop your video here'}</div>
        <div className="drop-sub">or click to browse — MP4, AVI, MOV, MKV, WebM</div>
      </div>

      {err && <div className="upload-error"><FiX size={13} /> {err}</div>}

      <div className="upload-tips">
        <div className="upload-tip"><strong>Best angle:</strong> Side view of cattle walking</div>
        <div className="upload-tip"><strong>What you get:</strong> Annotated frame, lameness score, and recommendation per animal</div>
      </div>
    </motion.div>
  );
}

/* ── Step 2: uploading + AI animation ── */
function StepUploading({ file, progress }) {
  const activeStep = progress < 100 ? 0 : progress >= 100 ? Math.min(3, Math.floor((progress - 100) / 20)) : 0;

  return (
    <motion.div className="upload-step" initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.34,ease }}>
      <h1 className="upload-title">Analysing Recording</h1>
      <p className="upload-sub">{file.name} · {fmt(file.size)}</p>

      {/* Upload progress */}
      <div className="up-progress-wrap">
        <div className="up-progress-bar">
          <motion.div className="up-progress-fill" style={{ width:`${progress}%` }} />
        </div>
        <div className="up-progress-row">
          <span className="up-progress-label">{progress < 100 ? 'Uploading…' : 'Processing…'}</span>
          <span className="up-progress-pct">{Math.min(progress, 100)}%</span>
        </div>
      </div>

      {/* AI step indicators */}
      <div className="ai-steps">
        {AI_STEPS.map((step, i) => {
          const done    = progress === 100 && i < activeStep;
          const active  = progress === 100 && i === activeStep;
          const pending = i > activeStep;
          const Icon = step.icon;
          return (
            <div key={i} className={`ai-step${done ? ' done' : active ? ' active' : pending ? ' pending' : ''}`}>
              <div className="ai-step-icon">
                {done ? <FiCheckCircle size={16} /> : active ? <Icon size={16} className="spin" /> : <Icon size={16} />}
              </div>
              <div>
                <div className="ai-step-label">{step.label}</div>
                <div className="ai-step-desc">{step.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ── Step 3: success ── */
function StepDone({ navigate }) {
  return (
    <motion.div className="upload-step upload-done" initial={{ opacity:0,scale:0.94 }} animate={{ opacity:1,scale:1 }} transition={{ duration:0.36,ease }}>
      <motion.div
        initial={{ scale:0 }} animate={{ scale:1 }}
        transition={{ type:'spring', stiffness:320, damping:22, delay:0.1 }}
        className="done-check"
      >
        <FiCheckCircle size={36} />
      </motion.div>
      <h1 className="upload-title">Analysis Queued</h1>
      <p className="upload-sub">Your recording has been uploaded. AI analysis is running in the background — results will appear in Reports within a minute.</p>

      <div className="done-actions">
        <button className="btn btn-teal" onClick={() => navigate('/history')}>
          View Reports <FiArrowRight size={14} />
        </button>
        <button className="btn btn-ghost" onClick={() => window.location.reload()}>
          Upload Another
        </button>
      </div>
    </motion.div>
  );
}

/* ── Root ── */
export default function VideoUpload() {
  const navigate = useNavigate();
  const [step, setStep]     = useState(0); // 0=drop, 1=uploading, 2=done
  const [file, setFile]     = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError]   = useState('');

  const handleFile = f => { setFile(f); };

  const handleUpload = () => {
    if (!file) return;
    setError('');
    setStep(1);
    setProgress(0);

    const fd = new FormData();
    fd.append('video', file);

    recordingsAPI.upload(fd, {
      onUploadProgress: ev => {
        const pct = Math.round((ev.loaded * 100) / ev.total);
        setProgress(pct);
      },
    }).then(() => {
      setProgress(100);
      setTimeout(() => setStep(2), 900);
    }).catch(err => {
      setError(err.response?.data?.error || 'Upload failed. Please try again.');
      setStep(0);
    });
  };

  return (
    <div className="upload-page">
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="drop" exit={{ opacity:0,y:-12 }} transition={{ duration:0.22,ease }}>
            <StepDrop onFile={f => { handleFile(f); }} />
            {file && (
              <motion.div initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.26,ease }} className="upload-file-preview">
                <FiVideo size={16} style={{ color:'var(--teal-dark)' }} />
                <span className="upload-file-name">{file.name}</span>
                <span className="upload-file-size">{fmt(file.size)}</span>
                <button className="btn btn-ghost upload-clear" onClick={() => setFile(null)}><FiX size={13} /></button>
                <button className="btn btn-teal" onClick={handleUpload}>
                  Analyse <FiArrowRight size={13} />
                </button>
              </motion.div>
            )}
            {error && <div className="upload-error"><FiX size={13} /> {error}</div>}
          </motion.div>
        )}
        {step === 1 && (
          <motion.div key="uploading" exit={{ opacity:0 }} transition={{ duration:0.2 }}>
            <StepUploading file={file} progress={progress} />
          </motion.div>
        )}
        {step === 2 && (
          <motion.div key="done" exit={{ opacity:0 }} transition={{ duration:0.2 }}>
            <StepDone navigate={navigate} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
