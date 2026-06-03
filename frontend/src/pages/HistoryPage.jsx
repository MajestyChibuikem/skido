import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiActivity, FiAlertTriangle, FiCheckCircle, FiClock,
  FiChevronDown, FiChevronUp, FiVideo, FiRefreshCw, FiAlertCircle, FiSearch,
} from 'react-icons/fi';
import { recordingsAPI } from '../api/client';

const ease = [0.25, 0.1, 0.25, 1];

/* ── helpers ── */
function fmtTs(sec) {
  if (sec == null) return null;
  const m = Math.floor(sec / 60), s = (sec % 60).toFixed(1);
  return `${String(m).padStart(2,'0')}:${s.padStart(4,'0')}s`;
}
function fmtScore(s) { return Number.isFinite(s) ? s.toFixed(1) : '—'; }

/* ── Lightbox ── */
function Lightbox({ url, label, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.82)',
        display:'flex',alignItems:'center',justifyContent:'center',cursor:'zoom-out',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.22, ease }}
        onClick={e => e.stopPropagation()}
        style={{ position:'relative', maxWidth:'92vw', maxHeight:'92vh' }}
      >
        <img src={url} alt={label}
          style={{ display:'block',maxWidth:'92vw',maxHeight:'86vh',borderRadius:16,
                   boxShadow:'0 24px 80px rgba(0,0,0,0.6)' }} />
        <div style={{
          position:'absolute',bottom:0,left:0,right:0,padding:'8px 14px',
          background:'rgba(0,0,0,0.55)',borderRadius:'0 0 16px 16px',
          color:'#fff',fontSize:12,fontWeight:600,backdropFilter:'blur(6px)',
        }}>{label}</div>
        <button onClick={onClose} style={{
          position:'absolute',top:-12,right:-12,width:28,height:28,borderRadius:'50%',
          border:'1px solid rgba(255,255,255,0.2)',background:'rgba(0,0,0,0.8)',
          color:'#fff',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',
        }}>×</button>
      </motion.div>
    </motion.div>
  );
}

/* ── Animal snapshot card — image is the hero ── */
function AnimalCard({ animal }) {
  const [lb, setLb] = useState(false);
  const url = animal.snapshot_filename ? recordingsAPI.snapshotUrl(animal.snapshot_filename) : null;
  const conf = animal.snapshot_confidence != null ? `${Math.round(animal.snapshot_confidence * 100)}%` : null;
  const ts = fmtTs(animal.snapshot_frame_sec);
  const score = fmtScore(animal.lameness_score);

  const STATUS_COLOR = { normal: 'var(--teal-dark)', suspected: 'var(--orange-dark)', confirmed: 'var(--red-dark)' };
  const color = STATUS_COLOR[animal.status] || 'var(--text-2)';
  const StatusIcon = animal.status === 'confirmed' ? FiAlertTriangle : animal.status === 'suspected' ? FiAlertCircle : FiCheckCircle;

  return (
    <>
      {lb && url && (
        <Lightbox url={url} label={`Animal ${animal.animal_index} · ${animal.status} · ${score}/10`} onClose={() => setLb(false)} />
      )}
      <div className="animal-card">
        {/* Image — primary focus */}
        <div className="animal-card-img-wrap" onClick={() => url && setLb(true)} style={{ cursor: url ? 'zoom-in' : 'default' }}>
          {url ? (
            <img src={url} alt={`Animal ${animal.animal_index}`} className="animal-card-img" />
          ) : (
            <div className="animal-card-img-empty">
              <FiVideo size={28} style={{ color: 'var(--text-3)' }} />
              <span>No snapshot</span>
            </div>
          )}
          {/* Status pill overlay */}
          <div className="animal-card-status-overlay">
            <span className={`status-pill ${animal.status}`}>
              <StatusIcon size={10} /> {animal.status}
            </span>
            {conf && <span className="animal-card-conf">{conf}</span>}
          </div>
        </div>

        {/* Meta below image */}
        <div className="animal-card-meta">
          <div className="animal-card-row">
            <span className="animal-card-id">Animal {animal.animal_index}</span>
            <span className="animal-card-score" style={{ color }}>
              {score} <span style={{ color:'var(--text-3)',fontWeight:400 }}>/10</span>
            </span>
          </div>

          {/* Score bar */}
          <div className="animal-score-track">
            <div className="animal-score-fill"
              style={{ width: `${(animal.lameness_score / 10) * 100}%`, background: color }} />
          </div>

          {(ts || animal.analyzed_at) && (
            <div className="animal-card-times">
              {ts && <span><FiClock size={10} /> {ts}</span>}
              {animal.analyzed_at && (
                <span>{new Date(animal.analyzed_at).toLocaleDateString()}</span>
              )}
            </div>
          )}

          <p className="animal-card-feedback">{animal.feedback}</p>
        </div>
      </div>
    </>
  );
}

/* ── Recording row — accordion ── */
function RecordingRow({ recording, onRetry, retrying }) {
  const [open, setOpen] = useState(false);
  const affectedCount = recording.animals.filter(a => a.status !== 'normal').length;
  const isProcessing = recording.status === 'pending' || recording.status === 'processing';

  return (
    <div className={`rec-row${open ? ' open' : ''}`}>
      <button className="rec-row-header" onClick={() => setOpen(o => !o)}>
        <div className="rec-row-left">
          <FiVideo size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <span className="rec-row-name">{recording.original_filename || recording.filename}</span>
        </div>
        <div className="rec-row-right">
          <span className="rec-row-date">{new Date(recording.upload_date).toLocaleDateString()}</span>
          <span className={`status-pill ${recording.status}`} style={{ fontSize: 11 }}>
            {isProcessing && <FiRefreshCw size={9} className="spin" />}
            {recording.status}
          </span>
          {recording.status === 'done' && affectedCount > 0 && (
            <span className="rec-row-alert">
              <FiAlertTriangle size={11} /> {affectedCount} detected
            </span>
          )}
          {recording.status === 'done' && (
            <span className="rec-row-count">{recording.animals.length} animal{recording.animals.length !== 1 ? 's' : ''}</span>
          )}
          {open ? <FiChevronUp size={15} style={{ color: 'var(--text-3)' }} /> : <FiChevronDown size={15} style={{ color: 'var(--text-3)' }} />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease }}
            style={{ overflow: 'hidden' }}
          >
            <div className="rec-row-panel">
              {isProcessing && (
                <div className="rec-processing">
                  <FiRefreshCw className="spin" /> Analysing — results will appear here automatically.
                </div>
              )}
              {recording.status === 'failed' && (
                <div className="rec-failed">
                  <FiAlertCircle /> Analysis failed.
                  <button
                    className="rec-retry-btn"
                    disabled={retrying}
                    onClick={() => onRetry(recording.id)}
                  >
                    <FiRefreshCw size={13} className={retrying ? 'spin' : ''} />
                    {retrying ? 'Retrying' : 'Retry analysis'}
                  </button>
                </div>
              )}
              {recording.status === 'done' && recording.animals.length === 0 && (
                <div className="rec-no-animals">No animals detected in this recording.</div>
              )}
              {recording.status === 'done' && recording.animals.length > 0 && (
                <div className="animal-grid">
                  {recording.animals
                    .slice().sort((a, b) => b.lameness_score - a.lameness_score)
                    .map(a => <AnimalCard key={a.id} animal={a} />)}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Page ── */
const FILTERS = ['all', 'detected', 'normal', 'processing'];

export default function HistoryPage() {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [retryingId, setRetryingId] = useState(null);

  const fetchRecordings = useCallback(() => {
    recordingsAPI.list()
      .then(res => setRecordings(res.data))
      .catch(err => console.error('Failed to load recordings:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchRecordings(); }, [fetchRecordings]);

  useEffect(() => {
    const busy = recordings.some(r => r.status === 'pending' || r.status === 'processing');
    if (!busy) return;
    const t = setTimeout(fetchRecordings, 5000);
    return () => clearTimeout(t);
  }, [recordings, fetchRecordings]);

  const retryRecording = useCallback((id) => {
    setRetryingId(id);
    recordingsAPI.retry(id)
      .then(res => {
        setRecordings(prev => prev.map(r => (r.id === id ? res.data : r)));
        setFilter('all');
      })
      .catch(err => console.error('Failed to retry recording:', err))
      .finally(() => setRetryingId(null));
  }, []);

  const filtered = recordings.filter(r => {
    const nameMatch = !query || (r.original_filename || r.filename || '').toLowerCase().includes(query.toLowerCase());
    if (!nameMatch) return false;
    if (filter === 'detected') return r.animals.some(a => a.status !== 'normal');
    if (filter === 'normal') return r.status === 'done' && r.animals.every(a => a.status === 'normal');
    if (filter === 'processing') return r.status === 'pending' || r.status === 'processing';
    return true;
  });

  const totalAnimals = recordings.reduce((s, r) => s + r.animals.length, 0);
  const totalDetected = recordings.reduce((s, r) => s + r.animals.filter(a => a.status !== 'normal').length, 0);

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh' }}>
      <div style={{ width:28,height:28,borderRadius:'50%',border:'2px solid var(--border-strong)',
                    borderTopColor:'var(--teal-dark)',animation:'spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div className="history-page">
      <motion.div initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.34,ease }}>
        {/* Header */}
        <div className="history-header">
          <div>
            <h1 className="history-title">Herd Health Reports</h1>
            <p className="history-sub">AI detection results, annotated frames, and treatment recommendations.</p>
          </div>
          <div className="history-kpis">
            <div className="history-kpi">
              <span>{recordings.length}</span><label>recordings</label>
            </div>
            <div className="history-kpi">
              <span>{totalAnimals}</span><label>animals</label>
            </div>
            <div className="history-kpi alert">
              <span>{totalDetected}</span><label>detected</label>
            </div>
          </div>
        </div>

        {/* Search + filters */}
        <div className="history-toolbar">
          <div className="history-search">
            <FiSearch size={14} style={{ color:'var(--text-3)' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search recordings…"
              className="history-search-input"
            />
          </div>
          <div className="history-filters">
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`history-filter-btn${filter === f ? ' active' : ''}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Recordings */}
        {filtered.length === 0 ? (
          <div className="history-empty">
            <FiActivity size={32} />
            <p>{recordings.length === 0 ? 'No recordings yet. Upload a herd recording to get started.' : 'No recordings match your filter.'}</p>
          </div>
        ) : (
          <div className="rec-list">
            {filtered.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }}
                transition={{ duration:0.28, ease, delay: i * 0.03 }}
              >
                <RecordingRow
                  recording={r}
                  onRetry={retryRecording}
                  retrying={retryingId === r.id}
                />
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
