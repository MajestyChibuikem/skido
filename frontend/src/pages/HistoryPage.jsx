import React, { useState, useEffect, useCallback } from 'react';
import {
  FaCamera,
  FaCheckCircle,
  FaClipboardList,
  FaExclamationTriangle,
  FaHeartbeat,
  FaRegClock,
  FaTimesCircle,
  FaCommentMedical,
  FaStethoscope,
  FaVideo,
  FaCircleNotch,
  FaExclamationCircle,
} from 'react-icons/fa';
import { recordingsAPI } from '../api/client';
import '../components/Cattle/Cattle.css';
import '../components/Analysis/Analysis.css';

const STATUS_COLORS = {
  normal:    '#65E4CF',
  suspected: '#f5a623',
  confirmed: '#e74c3c',
};

const RECORDING_STATUS_COLORS = {
  pending:    'rgba(255,255,255,0.35)',
  processing: '#f5a623',
  done:       '#65E4CF',
  failed:     '#e74c3c',
};

const STATUS_ICONS = {
  normal:    FaCheckCircle,
  suspected: FaExclamationTriangle,
  confirmed: FaTimesCircle,
};

/* ── Snapshot lightbox ───────────────────────────────────────────────── */
function SnapshotModal({ url, label, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'zoom-out',
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '92vw', maxHeight: '92vh' }}>
        <img
          src={url}
          alt={label}
          style={{
            display: 'block',
            maxWidth: '92vw',
            maxHeight: '86vh',
            borderRadius: 10,
            boxShadow: '0 12px 60px rgba(0,0,0,0.8)',
          }}
        />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '0.6rem 0.9rem',
          background: 'rgba(0,0,0,0.65)',
          borderRadius: '0 0 10px 10px',
          color: '#fff',
          fontSize: '0.88rem',
          fontWeight: 600,
          backdropFilter: 'blur(6px)',
        }}>
          {label}
        </div>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: -14, right: -14,
            width: 30, height: 30,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(30,30,30,0.9)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '1rem',
            lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

/* ── Single animal result card ───────────────────────────────────────── */
function AnimalBadge({ animal }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const color = STATUS_COLORS[animal.status] || 'rgba(255,255,255,0.4)';
  const StatusIcon = STATUS_ICONS[animal.status] || FaClipboardList;
  const score = Number.isFinite(animal.lameness_score) ? animal.lameness_score : 0;
  const snapshotUrl = animal.snapshot_filename
    ? recordingsAPI.snapshotUrl(animal.snapshot_filename)
    : null;
  const isConfirmed = animal.status === 'confirmed';
  const isSuspected = animal.status === 'suspected';
  const isAffected  = isConfirmed || isSuspected;

  const cardClass = [
    'animal-result-card',
    isConfirmed ? 'affected' : '',
    isSuspected ? 'suspected' : '',
  ].filter(Boolean).join(' ');

  const outlineClass = [
    'affected-outline',
    isSuspected && !isConfirmed ? 'suspected' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      {lightboxOpen && snapshotUrl && (
        <SnapshotModal
          url={snapshotUrl}
          label={`Animal ${animal.animal_index} — ${animal.status} (${score.toFixed(1)} / 10)`}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      <div className={cardClass}>
        {/* ── Snapshot column ── */}
        <div className="animal-snapshot-wrap">
          {snapshotUrl ? (
            <img
              src={snapshotUrl}
              alt={`Animal ${animal.animal_index}`}
              onClick={() => setLightboxOpen(true)}
              className="animal-snapshot"
              title="Click to enlarge"
            />
          ) : (
            <div className="animal-snapshot placeholder">
              <FaCamera />
            </div>
          )}

          {/* Red / orange square bounding-box overlay */}
          {isAffected && <div className={outlineClass} />}

          {/* Status badge on snapshot */}
          <div className={`snapshot-badge ${animal.status}`}>
            {animal.status}
          </div>
        </div>

        {/* ── Info column ── */}
        <div className="animal-result-main">
          <div className="animal-header">
            <div>
              <div className="animal-label">Detected animal</div>
              <div className="animal-status-row">
                <StatusIcon style={{ color, fontSize: '1rem' }} />
                <span className="animal-status-text" style={{ color }}>
                  Animal {animal.animal_index}
                </span>
                <span className="animal-score">{score.toFixed(1)} / 10</span>
              </div>
            </div>
            {animal.analyzed_at && (
              <div className="animal-time">
                <FaRegClock />
                {new Date(animal.analyzed_at).toLocaleString()}
              </div>
            )}
          </div>

          {/* Lameness score bar */}
          <div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)',
              marginBottom: '0.3rem',
            }}>
              <span>Lameness score</span>
              <span style={{ color, fontWeight: 700 }}>{score.toFixed(1)} / 10</span>
            </div>
            <div className="animal-meter">
              <div
                className="animal-meter-fill"
                style={{ width: `${(score / 10) * 100}%`, background: color }}
              />
            </div>
          </div>

          {/* Feedback + recommendation */}
          <div className="animal-message-grid">
            <div className="animal-message">
              <div className="animal-message-label">
                <FaCommentMedical /> Feedback
              </div>
              <p>{animal.feedback}</p>
            </div>
            <div className="animal-message">
              <div className="animal-message-label">
                <FaStethoscope /> Recommendation
              </div>
              <p>{animal.recommendation}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Recording list item ─────────────────────────────────────────────── */
function RecordingCard({ recording, selected, onClick }) {
  const color = RECORDING_STATUS_COLORS[recording.status] || 'rgba(255,255,255,0.4)';
  const affectedCount = recording.animals.filter(
    (a) => a.status === 'suspected' || a.status === 'confirmed'
  ).length;

  const StatusDot = () => {
    if (recording.status === 'processing') return <FaCircleNotch style={{ color, animation: 'spin 1.2s linear infinite' }} />;
    if (recording.status === 'failed')     return <FaExclamationCircle style={{ color }} />;
    if (recording.status === 'done')       return <FaCheckCircle style={{ color }} />;
    return <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />;
  };

  return (
    <div
      className={`recording-list-card${selected ? ' selected' : ''}`}
      onClick={onClick}
    >
      <div className="recording-card-name" title={recording.original_filename}>
        <FaVideo style={{ color: 'rgba(255,255,255,0.3)', marginRight: '0.4rem', fontSize: '0.78rem' }} />
        {recording.original_filename}
      </div>
      <div className="recording-card-date">
        {new Date(recording.upload_date).toLocaleString()}
      </div>
      <div className="recording-card-status" style={{ color }}>
        <StatusDot />
        <span>
          {recording.status.charAt(0).toUpperCase() + recording.status.slice(1)}
          {recording.status === 'done' &&
            ` · ${recording.animals.length} animal${recording.animals.length !== 1 ? 's' : ''}${affectedCount > 0 ? `, ${affectedCount} affected` : ''}`}
        </span>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */
function HistoryPage() {
  const [recordings, setRecordings] = useState([]);
  const [selected, setSelected]     = useState(null);
  const [loading, setLoading]       = useState(true);

  const fetchRecordings = useCallback(() => {
    recordingsAPI
      .list()
      .then((res) => {
        setRecordings(res.data);
        if (selected) {
          const updated = res.data.find((r) => r.id === selected.id);
          if (updated) setSelected(updated);
        }
      })
      .catch((err) => console.error('Failed to load recordings:', err))
      .finally(() => setLoading(false));
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchRecordings(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const hasProcessing = recordings.some(
      (r) => r.status === 'pending' || r.status === 'processing'
    );
    if (!hasProcessing) return;
    const timer = setTimeout(fetchRecordings, 5000);
    return () => clearTimeout(timer);
  }, [recordings, fetchRecordings]);

  if (loading) return <div className="loading">Loading recordings…</div>;

  const totals = recordings.reduce(
    (acc, r) => {
      r.animals.forEach((a) => {
        if (a.status === 'normal') acc.normal += 1;
        if (a.status === 'suspected' || a.status === 'confirmed') acc.affected += 1;
      });
      return acc;
    },
    { normal: 0, affected: 0 }
  );

  return (
    <div className="history-page">
      {/* Header */}
      <div className="history-header">
        <h1>Herd Health Reports</h1>
        <p>Review recordings, inspect flagged cows, and follow clear treatment guidance.</p>
      </div>

      {/* Summary pills */}
      <div className="history-summary-grid">
        <div className="summary-pill">
          <FaClipboardList />
          <div>
            <span>Total Recordings</span>
            <strong>{recordings.length}</strong>
          </div>
        </div>
        <div className="summary-pill">
          <FaCheckCircle />
          <div>
            <span>Normal Animals</span>
            <strong>{totals.normal}</strong>
          </div>
        </div>
        <div className="summary-pill affected">
          <FaHeartbeat />
          <div>
            <span>Affected Animals</span>
            <strong>{totals.affected}</strong>
          </div>
        </div>
      </div>

      {recordings.length === 0 ? (
        <div className="empty-state">
          <FaVideo style={{ fontSize: '2rem', marginBottom: '0.75rem', opacity: 0.3 }} />
          <p>No recordings yet. Upload a herd feed to get started.</p>
        </div>
      ) : (
        <div className="history-layout-grid">
          {/* Left — recording list */}
          <div className="history-column-panel">
            <div className="history-column-title">Recordings ({recordings.length})</div>
            {recordings.map((r) => (
              <RecordingCard
                key={r.id}
                recording={r}
                selected={selected?.id === r.id}
                onClick={() => setSelected(r)}
              />
            ))}
          </div>

          {/* Right — results */}
          <div className="history-column-panel">
            {selected ? (
              <>
                <div className="history-column-title" style={{ marginBottom: '1rem' }}>
                  {selected.original_filename}
                </div>

                {(selected.status === 'pending' || selected.status === 'processing') ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.65rem',
                    color: '#f5a623', fontSize: '0.9rem', padding: '1rem 0',
                  }}>
                    <FaCircleNotch style={{ animation: 'spin 1.2s linear infinite' }} />
                    Analysis in progress — results will appear here automatically.
                  </div>
                ) : selected.status === 'failed' ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.65rem',
                    color: '#e74c3c', fontSize: '0.9rem', padding: '1rem 0',
                  }}>
                    <FaExclamationCircle />
                    Analysis failed. Try re-uploading the recording.
                  </div>
                ) : selected.animals.length === 0 ? (
                  <div className="empty-state">
                    <p>No animals detected in this recording.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {/* Quick summary chips */}
                    <div className="selected-recording-summary">
                      <span style={{
                        background: 'rgba(231,76,60,0.1)',
                        borderColor: 'rgba(231,76,60,0.3)',
                        color: '#e74c3c',
                      }}>
                        {selected.animals.filter((a) => a.status === 'suspected' || a.status === 'confirmed').length} affected
                      </span>
                      <span style={{
                        background: 'rgba(101,228,207,0.07)',
                        borderColor: 'rgba(101,228,207,0.25)',
                        color: '#65E4CF',
                      }}>
                        {selected.animals.filter((a) => a.status === 'normal').length} normal
                      </span>
                    </div>

                    {/* Animal cards — affected first */}
                    {selected.animals
                      .slice()
                      .sort((a, b) => b.lameness_score - a.lameness_score)
                      .map((animal) => (
                        <AnimalBadge key={animal.id} animal={animal} />
                      ))}
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state" style={{ padding: '4rem 2rem' }}>
                <FaClipboardList style={{ fontSize: '2rem', marginBottom: '0.75rem', opacity: 0.25 }} />
                <p>Select a recording on the left to view results.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spin keyframe injected inline so no extra file needed */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default HistoryPage;
