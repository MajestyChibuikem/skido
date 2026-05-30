import React, { useState, useEffect, useCallback } from 'react';
import {
  FaCamera, FaCheckCircle, FaExclamationTriangle, FaTimesCircle,
  FaHeartbeat, FaRegClock, FaCommentMedical, FaStethoscope,
  FaVideo, FaCircleNotch, FaExclamationCircle, FaClipboardList,
  FaSearch, FaChevronDown, FaChevronUp, FaExpand,
} from 'react-icons/fa';
import { recordingsAPI } from '../api/client';
import '../components/Analysis/Analysis.css';

/* ── Palette ─────────────────────────────────────────────────────────────── */
const STATUS_COLOR = { normal: '#65E4CF', suspected: '#f5a623', confirmed: '#e74c3c' };
const STATUS_ICON  = { normal: FaCheckCircle, suspected: FaExclamationTriangle, confirmed: FaTimesCircle };
const REC_COLOR    = { pending: 'var(--text-muted)', processing: '#f5a623', done: '#65E4CF', failed: '#e74c3c' };

/* ── Full-screen snapshot lightbox ──────────────────────────────────────── */
function Lightbox({ url, label, onClose }) {
  useEffect(() => {
    const fn = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'zoom-out',
    }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
        <img src={url} alt={label} style={{
          display: 'block', maxWidth: '90vw', maxHeight: '84vh',
          borderRadius: 12, boxShadow: '0 20px 80px rgba(0,0,0,0.9)',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '0.7rem 1rem',
          background: 'rgba(0,0,0,0.7)',
          borderRadius: '0 0 12px 12px',
          color: '#fff', fontSize: '0.85rem', fontWeight: 600,
          backdropFilter: 'blur(8px)',
        }}>{label}</div>
        <button onClick={onClose} style={{
          position: 'absolute', top: -14, right: -14,
          width: 30, height: 30, borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.25)',
          background: 'rgba(20,20,20,0.95)',
          color: '#fff', cursor: 'pointer', fontSize: '1rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
      </div>
    </div>
  );
}

/* ── Snapshot card — core visual evidence ───────────────────────────────── */
function SnapshotCard({ animal }) {
  const [lb, setLb] = useState(false);
  const color   = STATUS_COLOR[animal.status] ?? 'var(--text-muted)';
  const Icon    = STATUS_ICON[animal.status]  ?? FaClipboardList;
  const score   = Number.isFinite(animal.lameness_score) ? animal.lameness_score : 0;
  const url     = animal.snapshot_filename ? recordingsAPI.snapshotUrl(animal.snapshot_filename) : null;
  const isAlerted = animal.status !== 'normal';

  return (
    <>
      {lb && url && (
        <Lightbox
          url={url}
          label={`Animal ${animal.animal_index} — ${animal.status} · ${score.toFixed(1)} / 10`}
          onClose={() => setLb(false)}
        />
      )}

      <div className={`snap-card ${animal.status}`}>
        {/* ── Snapshot (visual evidence first) ── */}
        <div className="snap-img-wrap" onClick={() => url && setLb(true)} title={url ? 'Click to enlarge' : undefined}>
          {url ? (
            <>
              <img src={url} alt={`Animal ${animal.animal_index}`} className="snap-img" />
              {/* Bounding-box overlay */}
              {isAlerted && <div className={`snap-bbox ${animal.status}`} />}
              {/* Expand icon */}
              <div className="snap-expand"><FaExpand /></div>
            </>
          ) : (
            <div className="snap-img-placeholder"><FaCamera /></div>
          )}
          {/* Status pill over snapshot */}
          <span className={`badge ${animal.status}`} style={{ position: 'absolute', top: 8, left: 8 }}>
            <Icon /> {animal.status}
          </span>
        </div>

        {/* ── Scores + info ── */}
        <div className="snap-info">
          <div className="snap-header">
            <div>
              <div className="snap-id">Animal {animal.animal_index}</div>
              <div className="snap-score-row">
                <Icon style={{ color, fontSize: '0.95rem' }} />
                <span style={{ color, fontWeight: 700, fontSize: '0.9rem', textTransform: 'capitalize' }}>
                  {animal.status}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {score.toFixed(1)} / 10
                </span>
              </div>
            </div>
            {animal.analyzed_at && (
              <div className="snap-time">
                <FaRegClock /> {new Date(animal.analyzed_at).toLocaleString()}
              </div>
            )}
          </div>

          {/* Score bar */}
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
              <span>Lameness score</span>
              <span style={{ color, fontWeight: 700 }}>{score.toFixed(1)} / 10</span>
            </div>
            <div className="snap-meter">
              <div className="snap-meter-fill" style={{ width: `${(score / 10) * 100}%`, background: color }} />
            </div>
          </div>

          {/* Feedback + recommendation */}
          <div className="snap-msgs">
            <div className="snap-msg">
              <div className="snap-msg-label"><FaCommentMedical /> Feedback</div>
              <p>{animal.feedback || '—'}</p>
            </div>
            <div className="snap-msg">
              <div className="snap-msg-label"><FaStethoscope /> Recommendation</div>
              <p>{animal.recommendation || '—'}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Recording row (expandable) ──────────────────────────────────────────── */
function RecordingRow({ recording }) {
  const [open, setOpen] = useState(false);
  const c = REC_COLOR[recording.status] ?? 'var(--text-muted)';
  const affected = recording.animals.filter(a => a.status !== 'normal').length;

  const StatusIcon = () => {
    if (recording.status === 'processing') return <FaCircleNotch style={{ color: c, animation: 'spin 1.1s linear infinite' }} />;
    if (recording.status === 'failed')     return <FaExclamationCircle style={{ color: c }} />;
    if (recording.status === 'done')       return <FaCheckCircle style={{ color: c }} />;
    return <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />;
  };

  const sortedAnimals = recording.animals
    .slice()
    .sort((a, b) => b.lameness_score - a.lameness_score);

  return (
    <div className={`rec-row${open ? ' open' : ''}`}>
      <button className="rec-row-header" onClick={() => setOpen(o => !o)}>
        <FaVideo style={{ color: 'var(--text-muted)', flexShrink: 0 }} />

        <div className="rec-row-name" title={recording.original_filename}>
          {recording.original_filename}
        </div>

        <div className="rec-row-meta">
          <span className="rec-row-date">{new Date(recording.upload_date).toLocaleDateString()}</span>
          <span className={`badge ${recording.status}`} style={{ gap: '0.3rem' }}>
            <StatusIcon /> {recording.status}
          </span>
          {recording.status === 'done' && (
            <>
              {affected > 0 && (
                <span className="badge suspected">{affected} affected</span>
              )}
              <span className="badge" style={{ background: 'var(--teal-dim)', color: 'var(--teal)', border: '1px solid rgba(101,228,207,0.25)' }}>
                {recording.animals.length} animals
              </span>
            </>
          )}
        </div>

        <div className="rec-row-chevron">
          {open ? <FaChevronUp /> : <FaChevronDown />}
        </div>
      </button>

      {open && (
        <div className="rec-row-body">
          {recording.status === 'processing' || recording.status === 'pending' ? (
            <div className="rec-processing">
              <FaCircleNotch style={{ animation: 'spin 1.1s linear infinite', color: '#f5a623' }} />
              Analysis in progress — results appear automatically when done.
            </div>
          ) : recording.status === 'failed' ? (
            <div className="rec-error">
              <FaExclamationCircle /> Analysis failed — try re-uploading the recording.
            </div>
          ) : sortedAnimals.length === 0 ? (
            <div className="rec-empty">No animals detected in this recording.</div>
          ) : (
            <>
              {/* Summary pills */}
              <div className="rec-summary">
                <span className="badge confirmed">
                  <FaExclamationTriangle /> {sortedAnimals.filter(a => a.status !== 'normal').length} affected
                </span>
                <span className="badge normal">
                  <FaCheckCircle /> {sortedAnimals.filter(a => a.status === 'normal').length} normal
                </span>
              </div>
              {/* Animal snapshot grid */}
              <div className="snap-grid">
                {sortedAnimals.map(a => (
                  <SnapshotCard key={a.id} animal={a} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function HistoryPage() {
  const [recordings, setRecordings] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState('all');
  const [search,     setSearch]     = useState('');

  const fetchRecordings = useCallback(() => {
    recordingsAPI.list()
      .then(r => setRecordings(r.data))
      .catch(e => console.error('History:', e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchRecordings(); }, [fetchRecordings]);

  useEffect(() => {
    const any = recordings.some(r => r.status === 'pending' || r.status === 'processing');
    if (!any) return;
    const t = setTimeout(fetchRecordings, 5000);
    return () => clearTimeout(t);
  }, [recordings, fetchRecordings]);

  const totals = recordings.reduce((acc, r) => {
    r.animals.forEach(a => {
      if (a.status === 'normal') acc.normal++;
      else acc.affected++;
    });
    return acc;
  }, { normal: 0, affected: 0 });

  const filtered = recordings.filter(r => {
    const nameMatch = r.original_filename.toLowerCase().includes(search.toLowerCase());
    if (!nameMatch) return false;
    if (filter === 'issues')     return r.animals.some(a => a.status !== 'normal');
    if (filter === 'clear')      return r.animals.every(a => a.status === 'normal') && r.status === 'done';
    if (filter === 'processing') return r.status === 'pending' || r.status === 'processing';
    return true;
  });

  if (loading) return <div className="hist-loading"><div className="db-spinner" />Loading recordings…</div>;

  return (
    <div className="hist-page">
      {/* Header */}
      <div className="hist-header">
        <div>
          <h1>Herd Health Reports</h1>
          <p>Review each recording, inspect AI-annotated snapshots, and follow per-cow guidance.</p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="hist-kpi-row">
        <div className="hist-kpi">
          <FaClipboardList style={{ color: 'var(--text-muted)' }} />
          <div>
            <strong>{recordings.length}</strong>
            <span>Recordings</span>
          </div>
        </div>
        <div className="hist-kpi">
          <FaCheckCircle style={{ color: 'var(--teal)' }} />
          <div>
            <strong>{totals.normal}</strong>
            <span>Normal animals</span>
          </div>
        </div>
        <div className="hist-kpi" style={{ borderColor: 'rgba(231,76,60,0.3)' }}>
          <FaHeartbeat style={{ color: 'var(--red)' }} />
          <div>
            <strong style={{ color: 'var(--red)' }}>{totals.affected}</strong>
            <span>Affected animals</span>
          </div>
        </div>
      </div>

      {recordings.length === 0 ? (
        <div className="hist-empty">
          <FaVideo style={{ fontSize: '2.5rem', color: 'var(--text-muted)' }} />
          <p>No recordings yet. Upload a herd recording to get started.</p>
        </div>
      ) : (
        <>
          {/* Filter / search bar */}
          <div className="hist-toolbar">
            <div className="hist-search">
              <FaSearch style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }} />
              <input
                type="text"
                placeholder="Search recordings…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="hist-filter-pills">
              {[
                ['all',        'All'],
                ['issues',     'Has Issues'],
                ['clear',      'Clear'],
                ['processing', 'Processing'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={`filter-pill${filter === key ? ' active' : ''}`}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Recording list */}
          <div className="hist-list">
            {filtered.length === 0 ? (
              <div className="hist-empty" style={{ margin: 0 }}>
                <p>No recordings match the current filter.</p>
              </div>
            ) : (
              filtered.map(r => <RecordingRow key={r.id} recording={r} />)
            )}
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
