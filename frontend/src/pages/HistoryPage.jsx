import React, { useState, useEffect } from 'react';
import { cattleAPI, videoAPI, analysisAPI } from '../api/client';
import AnalysisResultCard from '../components/Analysis/AnalysisResult';
import VideoPlayer from '../components/Video/VideoPlayer';
import '../components/Cattle/Cattle.css';

function HistoryPage() {
  const [cattle, setCattle] = useState([]);
  const [selectedCattle, setSelectedCattle] = useState('');
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cattleAPI
      .list()
      .then((res) => setCattle(res.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedCattle) {
      videoAPI
        .listByCattle(selectedCattle)
        .then((res) => setVideos(res.data))
        .catch((err) => console.error('Failed to load videos:', err));
    } else {
      setVideos([]);
    }
    setSelectedVideo(null);
    setAnalysis(null);
  }, [selectedCattle]);

  const handleSelectVideo = (video) => {
    setSelectedVideo(video);
    setAnalysis(null);
    if (video.has_analysis) {
      analysisAPI
        .get(video.id)
        .then((res) => setAnalysis(res.data))
        .catch((err) => console.error('Failed to load analysis:', err));
    }
  };

  const handleAnalyze = () => {
    if (!selectedVideo) return;
    setAnalyzing(true);
    analysisAPI
      .trigger(selectedVideo.id)
      .then((res) => setAnalysis(res.data))
      .catch((err) => console.error('Analysis failed:', err))
      .finally(() => setAnalyzing(false));
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="history-page">
      <h1 style={{ color: '#65E4CF', marginBottom: '1.5rem', fontWeight: 800 }}>Analysis History</h1>

      <div className="form-group" style={{ maxWidth: '400px', marginBottom: '1.5rem' }}>
        <label htmlFor="cattle-filter">Filter by Cattle</label>
        <select
          id="cattle-filter"
          value={selectedCattle}
          onChange={(e) => setSelectedCattle(e.target.value)}
        >
          <option value="">-- Select Cattle --</option>
          {cattle.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.tag ? `(#${c.tag})` : ''}
            </option>
          ))}
        </select>
      </div>

      {videos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div>
            <h3 style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '0.75rem' }}>Videos</h3>
            {videos.map((v) => (
              <div
                key={v.id}
                onClick={() => handleSelectVideo(v)}
                className="cattle-card"
                style={{
                  cursor: 'pointer',
                  marginBottom: '0.5rem',
                  borderColor: selectedVideo?.id === v.id ? '#65E4CF' : undefined,
                  borderWidth: selectedVideo?.id === v.id ? '1px' : undefined,
                }}
              >
                <p style={{ margin: 0, fontWeight: 600, color: '#e0e0e0' }}>{v.original_filename}</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)' }}>
                  {new Date(v.upload_date).toLocaleDateString()}
                  {v.has_analysis ? ' - Analyzed' : ' - Not analyzed'}
                </p>
              </div>
            ))}
          </div>

          <div>
            {selectedVideo && (
              <>
                <VideoPlayer videoId={selectedVideo.id} />
                {analysis ? (
                  <div style={{ marginTop: '1rem' }}>
                    <AnalysisResultCard result={analysis} />
                  </div>
                ) : (
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: '1rem' }}
                    onClick={handleAnalyze}
                    disabled={analyzing}
                  >
                    {analyzing ? 'Analyzing...' : 'Run Analysis'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {!selectedCattle && (
        <div className="empty-state">
          <p>Select a cattle record above to view its analysis history.</p>
        </div>
      )}

      {selectedCattle && videos.length === 0 && (
        <div className="empty-state">
          <p>No videos found for this cattle record.</p>
        </div>
      )}
    </div>
  );
}

export default HistoryPage;
