import React, { useState, useEffect, useCallback } from 'react';
import {
  FaCamera,
  FaCheckCircle,
  FaClipboardList,
  FaExclamationTriangle,
  FaHeartbeat,
  FaRegClock,
  FaTimesCircle,
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
  normal: FaCheckCircle,
  suspected: FaExclamationTriangle,
  confirmed: FaTimesCircle,
};

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
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'zoom-out',
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
        <img
          src={url}
          alt={label}
          style={{
            display: 'block',
            maxWidth: '90vw',
            maxHeight: '85vh',
            borderRadius: 8,
            boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
          }}
        />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '0.5rem 0.75rem',
          background: 'rgba(0,0,0,0.6)',
          borderRadius: '0 0 8px 8px',
          color: '#fff',
          fontSize: '0.9rem',
          fontWeight: 600,
        }}>
          {label}
        </div>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: -12, right: -12,
            width: 28, height: 28,
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255,255,255,0.15)',
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

function AnimalBadge({ animal }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const color = STATUS_COLORS[animal.status] || 'rgba(255,255,255,0.4)';
  const StatusIcon = STATUS_ICONS[animal.status] || FaClipboardList;
  const score = Number.isFinite(animal.lameness_score) ? animal.lameness_score : 0;
  const snapshotUrl = animal.snapshot_filename
    ? recordingsAPI.snapshotUrl(animal.snapshot_filename)
    : null;
  const isAffected = animal.status === 'suspected' || animal.status === 'confirmed';

  return (
    <>
      {lightboxOpen && snapshotUrl && (
        <SnapshotModal
          url={snapshotUrl}
          label={`Animal ${animal.animal_index} — ${animal.status} (${score.toFixed(1)}/10)`}
          onClose={() => setLightboxOpen(false)}
        />
      )}
      <div className={`animal-result-card ${isAffected ? 'affected' : ''}`}>
        <div className="animal-snapshot-wrap">
          {snapshotUrl ? (
            <img
              src={snapshotUrl}
              alt={`Animal ${animal.animal_index}`}
              onClick={() => setLightboxOpen(true)}
              className="animal-snapshot"
            />
          ) : (
            <div className="animal-snapshot placeholder">
              <FaCamera />
            </div>
          )}
          {isAffected && <div className="affected-outline" />}
        </div>

        <div className="animal-result-main">
          <div className="animal-header">
            <div>
              <div className="animal-label">Animal {animal.animal_index}</div>
              <div className="animal-status-row">
                <StatusIcon style={{ color }} />
                <span className="animal-status-text" style={{ color }}>
                  {animal.status}
                </span>
                <span className="animal-score">{score.toFixed(1)}/10</span>
              </div>
            </div>
            {animal.analyzed_at && (
              <div className="animal-time">
                <FaRegClock />
                {new Date(animal.analyzed_at).toLocaleString()}
              </div>
            )}
          </div>

          <div className="animal-meter">
            <div
              className="animal-meter-fill"
              style={{ width: `${(score / 10) * 100}%`, background: color }}
            />
          </div>

          <div className="animal-message-grid">
            <div className="animal-message">
              <span>Feedback</span>
              <p>{animal.feedback}</p>
            </div>
            <div className="animal-message">
              <span>Recommendation</span>
              <p>{animal.recommendation}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function RecordingCard({ recording, selected, onClick }) {
  const color = RECORDING_STATUS_COLORS[recording.status] || 'rgba(255,255,255,0.4)';
  return (
    <div
      className="cattle-card"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        marginBottom: '0.5rem',
        borderColor: selected ? '#65E4CF' : undefined,
        borderWidth: selected ? '1px' : undefined,
      }}
    >
      <p style={{ margin: 0, fontWeight: 700, color: '#e0e0e0' }}>
        {recording.original_filename}
      </p>
      <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)' }}>
        {new Date(recording.upload_date).toLocaleString()}
      </p>
      <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color }}>
        {recording.status.charAt(0).toUpperCase() + recording.status.slice(1)}
        {recording.status === 'done' && ` — ${recording.animals.length} animal(s) detected`}
      </p>
    </div>
  );
}

function HistoryPage() {
  const [recordings, setRecordings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRecordings = useCallback(() => {
    recordingsAPI
      .list()
      .then((res) => {
        setRecordings(res.data);
        // refresh selected if it's still processing
        if (selected) {
          const updated = res.data.find((r) => r.id === selected.id);
          if (updated) setSelected(updated);
        }
      })
      .catch((err) => console.error('Failed to load recordings:', err))
      .finally(() => setLoading(false));
  }, [selected]);

  useEffect(() => {
    fetchRecordings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll while any recording is still processing
  useEffect(() => {
    const hasProcessing = recordings.some(
      (r) => r.status === 'pending' || r.status === 'processing'
    );
    if (!hasProcessing) return;

    const timer = setTimeout(fetchRecordings, 5000);
    return () => clearTimeout(timer);
  }, [recordings, fetchRecordings]);

  if (loading) return <div className="loading">Loading...</div>;

  const totals = recordings.reduce(
    (acc, recording) => {
      recording.animals.forEach((animal) => {
        if (animal.status === 'normal') acc.normal += 1;
        if (animal.status === 'suspected' || animal.status === 'confirmed') acc.affected += 1;
      });
      return acc;
    },
    { normal: 0, affected: 0 }
  );

  return (
    <div className="history-page">
      <div className="history-header">
        <h1>Herd Health Reports</h1>
        <p>
          Review every recording, inspect affected cows, and follow clear recommendations.
        </p>
      </div>

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
          <p>No recordings yet. Upload a herd feed to get started.</p>
        </div>
      ) : (
        <div className="history-layout-grid">
          {/* Left — recording list */}
          <div className="history-column-panel">
            <h3 className="history-column-title">
              Recordings
            </h3>
            {recordings.map((r) => (
              <RecordingCard
                key={r.id}
                recording={r}
                selected={selected?.id === r.id}
                onClick={() => setSelected(r)}
              />
            ))}
          </div>

          {/* Right — results panel */}
          <div className="history-column-panel">
            {selected ? (
              <>
                <h3 className="history-column-title">
                  {selected.original_filename}
                </h3>

                {selected.status === 'pending' || selected.status === 'processing' ? (
                  <div style={{ color: '#f5a623', fontSize: '0.9rem' }}>
                    Analysis in progress — results will appear here automatically.
                  </div>
                ) : selected.status === 'failed' ? (
                  <div style={{ color: '#e74c3c', fontSize: '0.9rem' }}>
                    Analysis failed. Please try re-uploading the recording.
                  </div>
                ) : selected.animals.length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>
                    No animals detected in this recording.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {selected.animals
                      .slice()
                      .sort((a, b) => a.animal_index - b.animal_index)
                      .map((animal) => (
                        <AnimalBadge key={animal.id} animal={animal} />
                      ))}
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <p>Select a recording to view results.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default HistoryPage;
