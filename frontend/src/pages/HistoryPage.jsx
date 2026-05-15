import React, { useState, useEffect, useCallback } from 'react';
import { recordingsAPI } from '../api/client';
import '../components/Cattle/Cattle.css';

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

function AnimalBadge({ animal }) {
  const color = STATUS_COLORS[animal.status] || 'rgba(255,255,255,0.4)';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        padding: '0.5rem 0.75rem',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '8px',
        borderLeft: `3px solid ${color}`,
      }}
    >
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
        Animal {animal.animal_index}
      </span>
      <span
        style={{
          marginLeft: 'auto',
          color,
          fontWeight: 700,
          fontSize: '0.85rem',
          textTransform: 'capitalize',
        }}
      >
        {animal.status}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>
        {animal.lameness_score?.toFixed(1)}/10
      </span>
    </div>
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
      <p style={{ margin: 0, fontWeight: 600, color: '#e0e0e0' }}>
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

  return (
    <div className="history-page">
      <h1 style={{ color: '#65E4CF', marginBottom: '1.5rem', fontWeight: 800 }}>
        Recording History
      </h1>

      {recordings.length === 0 ? (
        <div className="empty-state">
          <p>No recordings yet. Upload a herd feed to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Left — recording list */}
          <div>
            <h3 style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '0.75rem' }}>
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
          <div>
            {selected ? (
              <>
                <h3 style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '0.75rem' }}>
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
